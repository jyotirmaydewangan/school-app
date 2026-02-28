import { CacheConfig, CACHE_SCOPES } from './CacheConfig.js';

export const CACHE_VERSION = 'v1';

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

  buildKeyForAction(tenantId, action, context = {}) {
    const scope = CacheConfig.getScope(action);
    const isBroad = CacheConfig.isBroad(action);
    const { token, queryParams = {}, body = null } = context;

    let key = `cache:${CACHE_VERSION}:${tenantId}:${action}`;

    // 1. Scope handling
    if (scope === CACHE_SCOPES.USER || scope === CACHE_SCOPES.SESSION) {
      if (token) {
        // Use a short, stable suffix from the token
        key += `:u${token.substring(token.length - 8)}`;
      }
    }

    // 2. Data Key handling (Broad vs Specific)
    if (!isBroad) {
      // For non-broad actions, we still need uniqueness but NO raw query params in the key.
      // We'll create a stable hash of the parameters.
      const ignoredParams = ['token', 'action', 'tenantId', 't', 'cache', 'force'];
      const filteredParams = Object.keys(queryParams)
        .filter(k => !ignoredParams.includes(k))
        .sort();

      let paramBits = '';
      if (filteredParams.length > 0) {
        paramBits = filteredParams.map(k => `${k}=${queryParams[k]}`).join('&');
      }

      // Also consider body if present
      if (body && typeof body === 'string') {
        paramBits += '|' + body;
      } else if (body && typeof body === 'object') {
        paramBits += '|' + JSON.stringify(body);
      }

      if (paramBits) {
        // Simple stable hash for the key bit
        const hash = this._simpleHash(paramBits);
        key += `:h${hash}`;
      }
    }

    return key;
  },

  _simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  },

  async get(tenantId, action, queryParams = {}) {
    if (!this.isEnabled()) {
      console.log('[KV] Get - KV not enabled');
      return null;
    }

    const key = this.buildKeyForAction(tenantId, action, { queryParams });
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

    // Safety: Never cache error responses or invalid objects
    if (!data || data.success === false || data.error) {
      console.warn(`[KV] Refused to cache error response for action: ${action}`);
      return;
    }

    const key = this.buildKeyForAction(tenantId, action, { queryParams });
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

    // Safety: Never cache error responses or invalid objects
    if (!data || data.success === false || data.error) {
      console.warn(`[KV] Refused to cache error response for key: ${key}`);
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

    const prefix = `cache:${CACHE_VERSION}:${tenantId}:${action}`;

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

  async applyMutation(tenantId, writeAction, payload) {
    if (!this.isEnabled()) return null;

    const targets = CacheConfig.getInvalidatePatterns(writeAction);
    const readActions = targets.filter(t => t.startsWith('get'));
    if (readActions.length === 0) return null;

    const mutations = [];
    let hasApplied = false;
    let finalItemId = null;
    let finalIdField = null;

    // Filter payload to prevent security leaks (token, password, etc.)
    const sensitiveKeys = ['token', 'password', 'key', 'secret', 'auth'];
    const filteredPayload = Object.keys(payload).reduce((acc, key) => {
      if (!sensitiveKeys.includes(key.toLowerCase())) {
        acc[key] = payload[key];
      }
      return acc;
    }, {});

    // Determine mutation type once
    const mutationType = writeAction.toLowerCase().includes('create') ? 'CREATE' :
      writeAction.toLowerCase().includes('delete') ? 'DELETE' : 'UPDATE';

    for (const readAction of readActions) {
      const key = this.buildKeyForAction(tenantId, readAction);
      const cached = await this.getByKey(key);
      if (!cached || !cached.data) continue;

      const previousData = JSON.parse(JSON.stringify(cached.data));
      let data = cached.data;
      let appliedToThisAction = false;

      if (Array.isArray(data)) {
        const { list: newList, applied, generatedId, idField } = this._mutateList(data, mutationType, filteredPayload);
        if (applied) {
          data = newList;
          appliedToThisAction = true;
          finalItemId = generatedId || finalItemId;
          finalIdField = idField;
        }
      } else {
        data = { ...data };
        for (const listKey in data) {
          if (Array.isArray(data[listKey])) {
            const { list: newList, applied, generatedId, idField } = this._mutateList(data[listKey], mutationType, filteredPayload);
            if (applied) {
              data[listKey] = newList;
              appliedToThisAction = true;
              finalItemId = generatedId || finalItemId;
              finalIdField = idField;
            }
          }
        }
      }

      if (appliedToThisAction) {
        await this.setByKey(key, data, readAction);
        mutations.push({ key, previousData, readAction, idField: finalIdField });
        hasApplied = true;
      }
    }

    if (!hasApplied) return null;

    const itemId = payload[finalIdField] || payload.id || payload.role_id || payload.user_id || payload.admission_no || finalItemId;

    return { mutations, identityField: finalIdField, itemId };
  },

  _extractItemIdFromMutatedData(mutation) {
    // Helper to find the newly created/updated ID if it's not in the payload
    return null; // Placeholder, the actionItemId logic above is better
  },

  async resolveMutation(tenantId, context, backendResponse) {
    if (!this.isEnabled() || !context) return;
    const { mutations, itemId } = context;

    // Safety check: Never resolve if itemId is missing (prevents overwriting entire lists)
    if (!itemId) return;

    for (const mut of mutations) {
      const { key, previousData, readAction, idField } = mut;

      if (backendResponse && backendResponse.success === false) {
        await this.setByKey(key, previousData, readAction);
        continue;
      }

      const cached = await this.getByKey(key);
      if (!cached || !cached.data) continue;

      let data = cached.data;
      let totalMatched = 0;

      if (Array.isArray(data)) {
        const { newList, matchedCount } = this._resolveList(data, idField, itemId, backendResponse);
        data = newList;
        totalMatched += matchedCount;
      } else {
        data = { ...data };
        for (const listKey in data) {
          if (Array.isArray(data[listKey])) {
            const { newList, matchedCount } = this._resolveList(data[listKey], idField, itemId, backendResponse);
            data[listKey] = newList;
            totalMatched += matchedCount;
          }
        }
      }

      // Self-healing: If backend succeeded but we couldn't resolve in cache, invalidate
      if (backendResponse && backendResponse.success !== false) {
        if (totalMatched === 0) {
          console.warn(`[KV] Self-healing: Invalidation required for ${key} - Resolution mismatch`);
          await this.kv.delete(key);
        } else {
          // Extra Guard: If any items STILL have _sync after a successful resolve, invalidate everything
          const hasResidualSync = Array.isArray(data)
            ? data.some(i => i._sync)
            : Object.values(data).some(list => Array.isArray(list) && list.some(i => i._sync));

          if (hasResidualSync) {
            console.warn(`[KV] Self-healing: Invalidation required for ${key} - Residual _sync detected`);
            await this.kv.delete(key);
          } else {
            await this.setByKey(key, data, readAction);
          }
        }
      }
    }
  },

  _mutateList(list, type, payload) {
    const listIdField = this._detectIdentityField(list, true);
    const itemId = this._extractItemId(payload);

    let applied = false;
    let generatedId = null;
    let newList = [...list];

    if (type === 'DELETE') {
      if (!itemId) return { list, applied: false };
      newList = newList.map(item => {
        if (String(item[listIdField]) === String(itemId) && itemId !== undefined) {
          applied = true;
          return { ...item, _sync: { status: 'pending_delete', updatedAt: Date.now() } };
        }
        return item;
      });
    } else if (type === 'UPDATE') {
      if (!itemId) return { list, applied: false };
      newList = newList.map(item => {
        if (String(item[listIdField]) === String(itemId) && itemId !== undefined) {
          applied = true;
          return { ...item, ...payload, _sync: { status: 'pending', updatedAt: Date.now() } };
        }
        return item;
      });
    } else { // CREATE
      // Optimization: Only unshift into lists where the identity field matches the payload context
      const isCorrectList = this._isPayloadCompatibleWithList(payload, listIdField, list);
      if (!isCorrectList) return { list, applied: false };

      generatedId = itemId || 'opt_' + Math.random().toString(36).substr(2, 9);
      const newItem = {
        ...payload,
        [listIdField]: generatedId,
        _sync: { status: 'pending', updatedAt: Date.now() }
      };
      newList.unshift(newItem);
      applied = true;
    }

    return { list: newList, applied, generatedId, idField: listIdField };
  },

  _isPayloadCompatibleWithList(payload, idField, list) {
    if (!list || list.length === 0) return true; // Empty list is always compatible

    const firstItem = list[0];

    // 1. Strict Identity Check
    // If the list has the idField and the payload has a value for it, they probably match
    if (firstItem[idField] !== undefined && payload[idField] !== undefined) return true;

    // 2. Generic Schema Overlap Check
    // Compare keys (excluding internal _sync and common id fields)
    const ignoreKeys = ['_sync', 'id', 'role_id', 'user_id', 'admission_no', 'created_at', 'updated_at'];
    const payloadKeys = Object.keys(payload).filter(k => !ignoreKeys.includes(k));
    const listKeys = Object.keys(firstItem).filter(k => !ignoreKeys.includes(k));

    const commonKeys = payloadKeys.filter(k => listKeys.includes(k));

    // If they share more than 1 distinct domain property (e.g. email, role_name, etc.), they are compatible
    return commonKeys.length > 0;
  },

  _resolveList(list, idField, itemId, backendResponse) {
    const isDelete = list.some(i => String(i[idField]) === String(itemId) && i._sync?.status === 'pending_delete');

    if (isDelete) {
      console.log(`[KV] Resolving DELETE for ${idField}=${itemId}`);
      const newList = list.filter(i => String(i[idField]) !== String(itemId));
      return { newList, matchedCount: list.length - newList.length };
    }

    const backendEntity = (backendResponse && backendResponse[idField] !== undefined) ? backendResponse :
      Object.values(backendResponse).find(val =>
        val && typeof val === 'object' && !Array.isArray(val) && val[idField] !== undefined
      ) || {};

    let matchedCount = 0;
    const newList = list.map(i => {
      if (String(i[idField]) === String(itemId) && itemId !== undefined) {
        matchedCount++;
        const { _sync, ...cleanItem } = i;
        // Merge clean item with backend entity, ensuring backend data wins
        return { ...cleanItem, ...backendEntity };
      }
      return i;
    });

    if (matchedCount > 0) {
      console.log(`[KV] Resolved ${matchedCount} items for ${idField}=${itemId}`);
    } else {
      console.warn(`[KV] No match found for resolution. Field: ${idField}, ID: ${itemId}`);
    }

    return { newList, matchedCount };
  },

  _detectIdentityField(data, isList = false) {
    const patterns = ['id', 'uid', 'admission_no', 'code', 'key'];

    // If it's a list, check the first item
    if (isList && Array.isArray(data) && data.length > 0) {
      const first = data[0];
      for (const p of patterns) {
        if (first[p] !== undefined) return p;
      }
      return Object.keys(first).find(k => k.endsWith('_id')) || 'id';
    }

    // If it's a payload object
    if (!isList && data && typeof data === 'object') {
      for (const p of patterns) {
        if (data[p] !== undefined) return p;
      }
      return Object.keys(data).find(k => k.endsWith('_id')) || 'id';
    }

    return 'id';
  },

  _extractItemId(payload) {
    if (!payload) return null;
    const idField = this._detectIdentityField(payload, false);
    return payload[idField] || payload.id || payload.role_id || payload.user_id || payload.admission_no || payload.id;
  },

  buildResponse(data, isStale = false) {
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      return {
        ...data,
        success: data.success !== undefined ? data.success : true,
        isFromCache: true,
        isStale: isStale
      };
    }
    return {
      success: true,
      data: data,
      isFromCache: true,
      isStale: isStale
    };
  },

  filterData(data, queryParams) {
    if (!data || !queryParams || Object.keys(queryParams).length === 0) return data;

    const ignoredParams = ['token', 'action', 'tenantId', 't', 'cache', 'force'];
    const filters = Object.fromEntries(
      Object.entries(queryParams).filter(([k]) => !ignoredParams.includes(k))
    );

    if (Object.keys(filters).length === 0) return data;

    const filterList = (list) => {
      return list.filter(item => {
        return Object.entries(filters).every(([key, value]) => {
          if (item[key] === undefined) return true; // Property doesn't exist on item, skip filter
          return String(item[key]) === String(value);
        });
      });
    };

    if (Array.isArray(data)) {
      return filterList(data);
    }

    if (typeof data === 'object') {
      const filtered = { ...data };
      for (const key in filtered) {
        if (Array.isArray(filtered[key])) {
          filtered[key] = filterList(filtered[key]);
        }
      }
      return filtered;
    }

    return data;
  }
};
