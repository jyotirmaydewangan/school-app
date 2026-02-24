import { CacheConfig } from './CacheConfig.js';

export const KVCacheHandler = {
  kv: null,
  env: null,

  init(env) {
    this.env = env;
    this.kv = env.DATA_CACHE || null;
    return this;
  },

  isEnabled() {
    if (!this.kv) {
      return false;
    }
    const enableKv = this.env.ENABLE_KV_CACHE;
    const isEnabled = enableKv === true || enableKv === 'true' || enableKv === '1' || enableKv === 1;
    return isEnabled;
  },

  buildCacheKey(tenantId, action, queryParams = {}) {
    let key = `cache:${tenantId}:${action}`;
    const sortedParams = Object.keys(queryParams).sort();
    if (sortedParams.length > 0) {
      const paramStr = sortedParams.map(k => `${k}=${queryParams[k]}`).join('&');
      key += `?${paramStr}`;
    }
    return key;
  },

  extractTokenFromBody(body) {
    try {
      const parsed = JSON.parse(body);
      return parsed?.token || null;
    } catch {
      return null;
    }
  },

  buildCacheKeyWithUser(tenantId, action, requestBody) {
    const userSpecificActions = ['verify', 'getAttendance', 'getTimetable', 'getMarks'];
    
    if (userSpecificActions.includes(action)) {
      const token = this.extractTokenFromBody(requestBody);
      if (token) {
        return `cache:${tenantId}:${action}:${token}`;
      }
    }
    return this.buildCacheKey(tenantId, action, {});
  },

  async get(tenantId, action, queryParams = {}) {
    if (!this.isEnabled()) {
      console.log('[KV] Get - KV not enabled');
      return null;
    }

    const key = this.buildCacheKey(tenantId, action, queryParams);
    console.log(`[KV] Get key: ${key}`);
    
    try {
      const cached = await this.kv.get(key, 'json');
      if (cached && cached.data) {
        const now = Date.now();
        const staleAt = cached.staleAt || 0;
        const expiresAt = cached.expiresAt || 0;
        
        console.log(`[KV] Cache hit! staleAt=${staleAt}, expiresAt=${expiresAt}, now=${now}`);
        
        const data = cached.data;
        const isEmpty = Array.isArray(data) ? data.length === 0 : !data || Object.keys(data).length === 0;
        
        if (isEmpty) {
          console.log('[KV] Cached data is empty, treating as miss');
          await this.kv.delete(key);
          return null;
        }
        
        return {
          data: cached.data,
          isStale: now > staleAt && now < expiresAt,
          isExpired: now >= expiresAt
        };
      } else {
        console.log('[KV] Cache miss for key:', key);
      }
    } catch (e) {
      console.error('KV get error:', e.message);
    }
    return null;
  },

  async set(tenantId, action, data, queryParams = {}) {
    if (!this.isEnabled()) {
      console.log('[KV] Set - KV not enabled');
      return;
    }

    const key = this.buildCacheKey(tenantId, action, queryParams);
    const ttl = CacheConfig.getTTL(action);
    const now = Date.now();
    const staleWhileRevalidate = Math.floor(ttl * 0.5);
    
    const cacheEntry = {
      data,
      createdAt: now,
      expiresAt: now + (ttl * 1000),
      staleAt: now + ((ttl - staleWhileRevalidate) * 1000)
    };

    try {
      await this.kv.put(key, JSON.stringify(cacheEntry), { expirationTtl: ttl + 60 });
      console.log(`[KV] Cached key: ${key} with TTL: ${ttl}s`);
    } catch (e) {
      console.error('KV set error:', e.message);
    }
  },

  async getByKey(key) {
    if (!this.isEnabled()) {
      return null;
    }

    console.log(`[KV] GetByKey: ${key}`);
    
    try {
      const cached = await this.kv.get(key, 'json');
      if (cached && cached.data) {
        const now = Date.now();
        const staleAt = cached.staleAt || 0;
        const expiresAt = cached.expiresAt || 0;
        
        console.log(`[KV] Cache hit! staleAt=${staleAt}, expiresAt=${expiresAt}, now=${now}`);
        
        const data = cached.data;
        const isEmpty = Array.isArray(data) ? data.length === 0 : !data || Object.keys(data).length === 0;
        
        if (isEmpty) {
          console.log('[KV] Cached data is empty, treating as miss');
          await this.kv.delete(key);
          return null;
        }
        
        return {
          data: cached.data,
          isStale: now > staleAt && now < expiresAt,
          isExpired: now >= expiresAt
        };
      } else {
        console.log('[KV] Cache miss for key:', key);
      }
    } catch (e) {
      console.error('KV getByKey error:', e.message);
    }
    return null;
  },

  async setByKey(key, data, action) {
    if (!this.isEnabled()) {
      console.log('[KV] SetByKey - KV not enabled');
      return;
    }

    const ttl = CacheConfig.getTTL(action);
    const now = Date.now();
    const staleWhileRevalidate = Math.floor(ttl * 0.5);
    
    const cacheEntry = {
      data,
      createdAt: now,
      expiresAt: now + (ttl * 1000),
      staleAt: now + ((ttl - staleWhileRevalidate) * 1000)
    };

    try {
      await this.kv.put(key, JSON.stringify(cacheEntry), { expirationTtl: ttl + 60 });
      console.log(`[KV] Cached key: ${key} with TTL: ${ttl}s`);
    } catch (e) {
      console.error('KV setByKey error:', e.message);
    }
  },

  async invalidate(tenantId, action) {
    if (!this.isEnabled()) return;

    const prefix = `cache:${tenantId}:${action}`;
    
    try {
      const list = await this.kv.list({ prefix });
      const keys = list.keys.map(k => k.name);
      
      for (const key of keys) {
        await this.kv.delete(key);
      }
      
      if (keys.length > 0) {
        console.log(`[KV] Invalidated ${keys.length} keys for ${action}`);
      }
    } catch (e) {
      console.error('KV invalidate error:', e.message);
    }
  },

  async invalidateByPattern(tenantId, patterns) {
    if (!this.isEnabled() || !patterns) return;

    for (const pattern of patterns) {
      await this.invalidate(tenantId, pattern);
    }
  },

  buildResponse(data, isStale = false) {
    const headers = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Cache-Control': 'private, max-age=0, must-revalidate',
      'X-Cache': isStale ? 'STALE' : 'HIT'
    };

    return new Response(JSON.stringify(data), {
      status: 200,
      headers
    });
  }
};
