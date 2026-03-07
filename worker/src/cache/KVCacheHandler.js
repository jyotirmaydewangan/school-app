import { CacheConfig, CACHE_SCOPES } from './CacheConfig.js';

export const CACHE_VERSION = (function () {
  const v = '{CACHE_VERSION}';
  return v.startsWith('{') ? 'v1' : v;
})();

const ATTENDANCE_KEY_PREFIX = 'attendance';

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

    let key = "cache:" + CACHE_VERSION + ":" + tenantId + ":" + action;

    // 1. Scope handling
    if (scope === CACHE_SCOPES.USER || scope === CACHE_SCOPES.SESSION) {
      if (token) {
        // Use a short, stable suffix from the token
        key += `:u${token.substring(token.length - 8)}`;
      }
    }

    const keyParams = CacheConfig.getRule(action)?.keyParameters;

    // 2. Data Key handling (Broad vs Specific)
    if (keyParams && keyParams.length > 0) {
      // READABLE KEYS: Use explicit parameters if defined
      let hasMissingRequiredParam = false;
      const parts = keyParams.map(p => {
        const lowerP = p.toLowerCase();
        const baseP = lowerP.replace(/[^a-z0-9]/g, '');

        // Robust lookup: try direct match, then search all keys for a fuzzy match
        let val = queryParams[p] || queryParams[lowerP] || queryParams[lowerP + '_id'] ||
          (body ? (body[p] || body[lowerP] || body[lowerP + '_id']) : null);

        if (val === undefined || val === null) {
          // Fuzzy search in both queryParams and body keys
          const searchSources = [queryParams, body].filter(s => s && typeof s === 'object');
          for (const source of searchSources) {
            const matchingKey = Object.keys(source).find(k => {
              const normalizedK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
              return normalizedK === baseP || normalizedK === baseP + 'id';
            });
            if (matchingKey) {
              val = source[matchingKey];
              break;
            }
          }
        }

        if (val === undefined || val === null) {
          // Strictly REQUIRED parameters for specific caching
          const isRequired = ['class', 'year', 'month', 'student', 'id', 'user'].includes(baseP);
          if (isRequired) {
            hasMissingRequiredParam = true;
          }
          return 'any';
        }
        return String(val);
      });

      // SAFETY: If a partitioned broad action is missing its REQUIRED keys, do NOT cache it
      if (hasMissingRequiredParam && isBroad) {
        console.warn(`[KV] Missing required key parameters for ${action}. Falling back to 'any'.`);
        // return null;
      }
      key += ":" + parts.join(':');
    } else if (!isBroad) {
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
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  },

  buildAttendanceKey(className, section, date) {
    const normalizedClass = (className || '').toLowerCase().replace(/[^a-z0-9]/g, '_');
    const normalizedSection = (section || 'nosection').toLowerCase().replace(/[^a-z0-9]/g, '_');
    const normalizedDate = date || '';
    return `${ATTENDANCE_KEY_PREFIX}:${normalizedClass}:${normalizedSection}:${normalizedDate}`;
  },

  async get(tenantId, action, queryParams = {}) {
    if (!this.isEnabled()) {
      return null;
    }

    const key = this.buildKeyForAction(tenantId, action, { queryParams });

    try {
      const cached = await this.kv.get(key, 'json');
      if (cached && cached.data) {
        const now = Date.now();
        const staleAt = cached.staleAt || 0;
        const expiresAt = cached.expiresAt || 0;

        const data = cached.data;
        const isEmpty = Array.isArray(data) ? data.length === 0 : !data || Object.keys(data).length === 0;

        if (isEmpty) {
          await this.kv.delete(key);
          return null;
        }

        return {
          data: cached.data,
          isStale: now > staleAt && now < expiresAt,
          isExpired: now >= expiresAt
        };
      }
    } catch (e) {
      console.error('KV get error:', e.message);
    }
    return null;
  },

  async set(tenantId, action, data, queryParams = {}) {
    if (!this.isEnabled()) return;

    // Safety: Never cache error responses or invalid objects
    if (!data || data.success === false || data.error) return;

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
    } catch (e) {
      console.error('KV set error:', e.message);
    }
  },

  async getByKey(key) {
    if (!this.isEnabled()) return null;

    try {
      const cached = await this.kv.get(key, 'json');
      if (cached && cached.data) {
        const now = Date.now();
        const staleAt = cached.staleAt || 0;
        const expiresAt = cached.expiresAt || 0;

        const data = cached.data;
        const isEmpty = Array.isArray(data) ? data.length === 0 : !data || Object.keys(data).length === 0;

        if (isEmpty) {
          await this.kv.delete(key);
          return null;
        }

        return {
          data: cached.data,
          isStale: now > staleAt && now < expiresAt,
          isExpired: now >= expiresAt
        };
      }
    } catch (e) {
      console.error('KV getByKey error:', e.message);
    }
    return null;
  },

  async setByKey(key, data, action) {
    if (!this.isEnabled()) return;

    // Safety: Never cache error responses or invalid objects
    if (!data || data.success === false || data.error) return;

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
    } catch (e) {
      console.error('KV setByKey error:', e.message);
    }
  },

  async invalidate(tenantId, action, context = null) {
    if (!this.isEnabled()) return;

    const rule = CacheConfig.getRule(action);
    const keyParams = rule?.keyParameters;

    // TARGETED INVALIDATION: If we have context (write payload) and it provides all key parameters
    if (keyParams && keyParams.length > 0 && context) {
      // Create a copy to avoid mutating the original body while enriching
      const enrichedContext = { ...context };

      // Enrich context with year/month if only date is present
      if (enrichedContext.date && (!enrichedContext.year || !enrichedContext.month)) {
        const parts = enrichedContext.date.split('-');
        if (parts.length >= 2) {
          enrichedContext.year = parts[0];
          enrichedContext.month = parts[1];
        }
      }

      console.warn(`[KV] Checking targeted invalidation for ${action}. KeyParams: ${keyParams.join(', ')}. Context enriched: ${JSON.stringify(enrichedContext)}`);

      // Check if context satisfies all key parameters (robust fuzzy matching)
      const hasAllParams = keyParams.every(p => {
        const baseP = p.toLowerCase().replace(/[^a-z0-9]/g, '');
        const matchingKey = Object.keys(enrichedContext).find(k => {
          const normalizedK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
          return normalizedK === baseP || normalizedK === baseP + 'id';
        });
        const found = matchingKey !== undefined && enrichedContext[matchingKey] !== null;
        console.warn(`[KV] Param ${p} (base: ${baseP}) matching key in context: ${matchingKey || 'NONE'}. Value: ${matchingKey ? enrichedContext[matchingKey] : 'n/a'}`);
        return found;
      });

      if (hasAllParams) {
        const key = this.buildKeyForAction(tenantId, action, { body: enrichedContext });
        console.warn(`[KV] TARGETED INVALIDATION MATCHED! Deleting key: ${key}`);
        await this.kv.delete(key);
        return;
      }
      console.warn(`[KV] Falling back to broad invalidation for ${action} due to missing params. Context keys: ${Object.keys(enrichedContext).join(', ')}`);
    }

    const baseKey = "cache:" + CACHE_VERSION + ":" + tenantId + ":" + action;
    const prefix = baseKey + ":";
    console.warn(`[KV] BROAD INVALIDATION! Deleting base key and scanning prefix: ${prefix} ...`);

    try {
      await this.kv.delete(baseKey);
      const list = await this.kv.list({ prefix });
      const keys = list.keys.map(k => k.name);

      for (const key of keys) {
        await this.kv.delete(key);
      }
    } catch (e) {
      console.error('KV invalidate error:', e.message);
    }
  },

  async invalidateByPattern(tenantId, patterns, context = null) {
    if (!this.isEnabled() || !patterns) return;

    for (const pattern of patterns) {
      await this.invalidate(tenantId, pattern, context);
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

    const sensitiveKeys = ['token', 'password', 'key', 'secret', 'auth'];
    const filteredPayload = Object.keys(payload).reduce((acc, key) => {
      if (!sensitiveKeys.includes(key.toLowerCase())) {
        acc[key] = payload[key];
      }
      return acc;
    }, {});

    let mutationType = writeAction.toLowerCase().includes('create') ? 'CREATE' :
      writeAction.toLowerCase().includes('delete') ? 'DELETE' : 'UPDATE';

    const actionLower = writeAction.toLowerCase();
    if (actionLower === 'approveuser') {
      filteredPayload.is_approved = true;
      filteredPayload.rejected_at = "";
    } else if (actionLower === 'rejectuser') {
      filteredPayload.is_approved = false;
      filteredPayload.rejected_at = new Date().toISOString();
    }

    for (const readAction of readActions) {
      const key = this.buildKeyForAction(tenantId, readAction);
      const cached = await this.getByKey(key);
      if (!cached || !cached.data) continue;

      const previousData = JSON.parse(JSON.stringify(cached.data));
      let data = cached.data;
      let appliedToThisAction = false;

      if (Array.isArray(data)) {
        const { list: newList, applied, matchedId, idField } = this._mutateList(data, mutationType, filteredPayload);
        if (applied) {
          data = newList;
          appliedToThisAction = true;
          finalItemId = matchedId || finalItemId;
          finalIdField = idField;
        }
      } else {
        data = { ...data };
        for (const listKey in data) {
          let listData = data[listKey];
          if (listData && typeof listData === 'object' && !Array.isArray(listData) && listData.schools && Array.isArray(listData.schools)) {
            const { list: newList, applied, matchedId, idField } = this._mutateList(listData.schools, mutationType, filteredPayload);
            if (applied) {
              data[listKey] = { ...listData, schools: newList };
              appliedToThisAction = true;
              finalItemId = matchedId || finalItemId;
              finalIdField = idField;
            }
          } else if (Array.isArray(listData)) {
            const { list: newList, applied, matchedId, idField } = this._mutateList(listData, mutationType, filteredPayload);
            if (applied) {
              data[listKey] = newList;
              appliedToThisAction = true;
              if (matchedId) finalItemId = matchedId;
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

    const itemId = finalItemId || this._extractItemId(payload, finalIdField);
    return { mutations, identityField: finalIdField, itemId };
  },

  async resolveMutation(tenantId, context, backendResponse) {
    if (!this.isEnabled() || !context) return;
    const { mutations, itemId } = context;

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
          let listData = data[listKey];
          if (listData && typeof listData === 'object' && !Array.isArray(listData) && listData.schools && Array.isArray(listData.schools)) {
            const { newList, matchedCount } = this._resolveList(listData.schools, idField, itemId, backendResponse);
            data[listKey] = { ...listData, schools: newList };
            totalMatched += matchedCount;
          } else if (Array.isArray(data[listKey])) {
            const { newList, matchedCount } = this._resolveList(data[listKey], idField, itemId, backendResponse);
            data[listKey] = newList;
            totalMatched += matchedCount;
          }
        }
      }

      if (backendResponse && backendResponse.success !== false) {
        if (totalMatched === 0) {
          await this.kv.delete(key);
        } else {
          const hasResidualSync = Array.isArray(data)
            ? data.some(i => i._sync)
            : Object.values(data).some(list => Array.isArray(list) && list.some(i => i._sync));

          if (hasResidualSync) {
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
    let matchedId = null;
    let newList = [...list];

    if (type === 'DELETE') {
      if (!itemId) return { list, applied: false };
      newList = newList.map(item => {
        if (String(item[listIdField]) === String(itemId) && itemId !== undefined) {
          applied = true;
          matchedId = itemId;
          return { ...item, _sync: { status: 'pending_delete', updatedAt: Date.now() } };
        }
        return item;
      });
    } else if (type === 'UPDATE') {
      if (!itemId) return { list, applied: false };
      newList = newList.map(item => {
        if (String(item[listIdField]) === String(itemId) && itemId !== undefined) {
          applied = true;
          matchedId = itemId;
          return { ...item, ...payload, _sync: { status: 'pending', updatedAt: Date.now() } };
        }
        return item;
      });
    } else { // CREATE
      const isCorrectList = this._isPayloadCompatibleWithList(payload, listIdField, list);
      if (!isCorrectList) return { list, applied: false };

      matchedId = itemId || 'opt_' + Math.random().toString(36).substr(2, 9);
      const newItem = {
        ...payload,
        [listIdField]: matchedId,
        _sync: { status: 'pending', updatedAt: Date.now() }
      };
      newList.unshift(newItem);
      applied = true;
    }

    return { list: newList, applied, matchedId, idField: listIdField };
  },

  _isPayloadCompatibleWithList(payload, idField, list) {
    if (!list || list.length === 0) return true;
    const firstItem = list[0];
    if (firstItem[idField] !== undefined && payload[idField] !== undefined) return true;
    const ignoreKeys = ['_sync', 'id', 'role_id', 'user_id', 'admission_no', 'created_at', 'updated_at'];
    const payloadKeys = Object.keys(payload).filter(k => !ignoreKeys.includes(k));
    const listKeys = Object.keys(firstItem).filter(k => !ignoreKeys.includes(k));
    const commonKeys = payloadKeys.filter(k => listKeys.includes(k));
    return commonKeys.length > 0;
  },

  _resolveList(list, idField, itemId, backendResponse) {
    const isDelete = list.some(i => String(i[idField]) === String(itemId) && i._sync?.status === 'pending_delete');

    if (isDelete) {
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
        if (backendEntity._error) {
          return { ...cleanItem, _sync: { status: 'error', error: backendEntity._error, updatedAt: Date.now() } };
        }
        return { ...cleanItem, ...backendEntity };
      }
      return i;
    });

    return { newList, matchedCount };
  },

  _detectIdentityField(data, isList = false) {
    const patterns = ['id', 'uid', 'userId', 'user_id', 'admission_no', 'code', 'key'];
    if (isList && Array.isArray(data) && data.length > 0) {
      const first = data[0];
      for (const p of patterns) {
        if (first[p] !== undefined) return p;
      }
      return Object.keys(first).find(k => k.endsWith('_id')) || 'id';
    }
    if (!isList && data && typeof data === 'object') {
      for (const p of patterns) {
        if (data[p] !== undefined) return p;
      }
      return Object.keys(data).find(k => k.endsWith('_id')) || 'id';
    }
    return 'id';
  },

  _extractItemId(payload, idFieldHint) {
    if (!payload) return null;
    const idField = idFieldHint || this._detectIdentityField(payload, false);
    return payload[idField] || payload.id || payload.role_id || payload.user_id || payload.admission_no || payload.userId;
  },

  _extractItemIdFromMutatedData(payload) {
    return this._extractItemId(payload);
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
          if (item[key] === undefined) return true;
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
