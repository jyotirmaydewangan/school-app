import { RouteConfig, RequestParser } from './routes/RouteConfig.js';
import { CorsMiddleware } from './middleware/CorsMiddleware.js';
import { AuthMiddleware } from './middleware/AuthMiddleware.js';
import { CacheConfig } from './cache/CacheConfig.js';
import { KVCacheHandler } from './cache/KVCacheHandler.js';
import { ResponseHandler } from './utils/ResponseHandler.js';
globalThis.workerEnv = {};

const Router = {
  create(env, ctx) {
    globalThis.workerEnv = env;
    const kvHandler = KVCacheHandler.init(env);
    return {
      env,
      ctx,
      kvHandler,
      responseHandler: ResponseHandler.init(caches.default),

      async route(request) {
        const { method, url } = request;
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        const action = RouteConfig.parsePath(pathname);
        const isPostReadAction = method === 'POST' && CacheConfig.isPostReadAction(action);

        const tenantId = this.env.TENANT_ID || 'unknown';

        if (method === 'OPTIONS') {
          return CorsMiddleware.handleOptions();
        }

        if (!RouteConfig.shouldHandle(method)) {
          return this.responseHandler.notFound(action);
        }

        if (isPostReadAction) {
          return this.handlePostReadRequest(request, action, urlObj, tenantId);
        }

        const isWriteRequest = RouteConfig.isWriteRequest(method);
        if (isWriteRequest) {
          return this.handleWriteRequest(request, action, method, urlObj, tenantId);
        }

        return this.handleReadRequest(request, action, method, urlObj, tenantId);
      },

      async handlePostReadRequest(request, action, urlObj, tenantId) {
        const isCacheable = CacheConfig.shouldCache(action);
        const queryParams = Object.fromEntries(urlObj.searchParams);
        const cacheHeader = request.headers.get('X-Cache-Control');

        const body = await RequestParser.parseBody(request);
        const token = AuthMiddleware.extractToken(request);
        const bodyWithToken = AuthMiddleware.addTokenToBody(body, token);

        let forceRefresh = cacheHeader === 'no-cache';
        if (!forceRefresh && body) {
          try {
            const parsed = JSON.parse(body);
            if (parsed.cache === 'false' || parsed.force === 'true') {
              forceRefresh = true;
            }
          } catch (e) { }
        }

        const isBroad = CacheConfig.isBroad(action);
        const cacheKey = this.kvHandler.buildKeyForAction(tenantId, action, {
          token,
          queryParams: isBroad ? {} : queryParams, // Broad caching uses a generic key
          body: isBroad ? null : bodyWithToken    // Broad caching excludes specific body filters from key
        });

        if (this.kvHandler.isEnabled() && isCacheable && !forceRefresh) {
          const cached = await this.kvHandler.getByKey(cacheKey);

          if (cached && !cached.isExpired) {
            if (cached.isStale) {
              this.refreshPostInBackground(tenantId, action, request, cacheKey);
            }

            // Apply Worker-side filtering for Broad Master Lists
            const filteredData = isBroad ? this.kvHandler.filterData(cached.data, queryParams) : cached.data;
            const result = this.kvHandler.buildResponse(filteredData, cached.isStale);

            return new Response(JSON.stringify(result), {
              status: 200,
              headers: {
                'Content-Type': 'application/json',
                'X-Cache': cached.isStale ? 'STALE' : 'HIT',
                'X-Cache-Key': isBroad ? 'MASTER' : 'DATA',
                ...CorsMiddleware.buildHeaders()
              }
            });
          }
        }

        return this.proxyToBackend(request, action, 'POST', isCacheable, urlObj, tenantId, queryParams, bodyWithToken);
      },

      async refreshPostInBackground(tenantId, action, originalRequest, cacheKey) {
        try {
          const scriptUrl = this.env.SCRIPT_URL;
          if (!scriptUrl) return;

          const apiUrl = RequestParser.buildApiUrl(scriptUrl, action, {});
          const body = await RequestParser.parseBody(originalRequest);
          const token = AuthMiddleware.extractToken(originalRequest);
          const bodyWithToken = AuthMiddleware.addTokenToBody(body, token);

          const fetchOptions = {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: bodyWithToken
          };

          const response = await fetch(apiUrl, fetchOptions);
          if (response.ok) {
            const data = await response.json();
            if (data && data.success !== false) {
              if (cacheKey) {
                await this.kvHandler.setByKey(cacheKey, data, action);
              } else {
                await this.kvHandler.set(tenantId, action, data, {});
              }
            }
          }
        } catch (e) {
          // Silent fail for background refresh
        }
      },

      async handleReadRequest(request, action, method, urlObj, tenantId) {
        const isCacheable = CacheConfig.shouldCache(action);
        const queryParams = Object.fromEntries(urlObj.searchParams);
        const cacheHeader = request.headers.get('X-Cache-Control');

        let forceRefresh = queryParams.cache === 'false' || queryParams.force === 'true' || cacheHeader === 'no-cache';

        if (this.kvHandler.isEnabled() && isCacheable && !forceRefresh) {
          const token = AuthMiddleware.extractToken(request);
          const isBroad = CacheConfig.isBroad(action);

          const cacheKey = this.kvHandler.buildKeyForAction(tenantId, action, {
            token,
            queryParams: isBroad ? {} : queryParams
          });

          const cached = await this.kvHandler.getByKey(cacheKey);

          if (cached && !cached.isExpired) {
            if (cached.isStale) {
              this.refreshInBackground(tenantId, action, queryParams, request);
            }

            // Apply Worker-side filtering for Broad Master Lists
            const filteredData = isBroad ? this.kvHandler.filterData(cached.data, queryParams) : cached.data;
            const result = this.kvHandler.buildResponse(filteredData, cached.isStale);

            return new Response(JSON.stringify(result), {
              status: 200,
              headers: {
                'Content-Type': 'application/json',
                'X-Cache': cached.isStale ? 'STALE' : 'HIT',
                'X-Cache-Key': isBroad ? 'MASTER' : 'DATA',
                ...CorsMiddleware.buildHeaders()
              }
            });
          }
        }

        return this.proxyToBackend(request, action, method, isCacheable, urlObj, tenantId, queryParams);
      },

      async refreshInBackground(tenantId, action, queryParams, originalRequest) {
        try {
          const scriptUrl = this.env.SCRIPT_URL;
          if (!scriptUrl) return;

          const apiUrl = RequestParser.buildApiUrl(scriptUrl, action, queryParams);
          const token = AuthMiddleware.extractToken(originalRequest);

          const fetchOptions = {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': token ? `Bearer ${token}` : ''
            }
          };

          const response = await fetch(apiUrl, fetchOptions);
          if (response.ok) {
            const data = await response.json();
            if (data && data.success !== false) {
              await this.kvHandler.set(tenantId, action, data, queryParams);
              console.log(`[KV] Background refresh completed for ${action}`);
            }
          }
        } catch (e) {
          console.error(`[KV] Background refresh failed: ${e.message}`);
        }
      },

      async handleWriteRequest(request, action, method, urlObj, tenantId) {
        const bodyText = await RequestParser.parseBody(request);
        const body = bodyText ? JSON.parse(bodyText) : {};

        console.warn(`[Worker] ===== HANDLING WRITE: ${action} =====`);
        console.warn(`[Worker] Body:`, body);

        // Generic Mutation Handling - Applies to any action with a 'get*' invalidation pattern
        const mutationContext = await this.kvHandler.applyMutation(tenantId, action, body);

        console.warn(`[Worker] ===== MUTATION RESULT: ${mutationContext ? 'APPLIED' : 'NULL'} =====`);

        if (mutationContext) {
          console.warn(`[Worker] Action ${action} applied optimistically to ${mutationContext.readAction}`);

          const syncTask = async () => {
            try {
              const response = await this.proxyToBackend(request, action, method, false, urlObj, tenantId, {}, bodyText);
              const result = await response.json();
              await this.kvHandler.resolveMutation(tenantId, mutationContext, result);
            } catch (e) {
              console.error(`[Worker] Background sync failed for ${action}:`, e.message);
              await this.kvHandler.resolveMutation(tenantId, mutationContext, { success: false, error: e.message });
            }
          };

          if (this.ctx) {
            this.ctx.waitUntil(syncTask());
          } else {
            await syncTask();
          }

          return new Response(JSON.stringify({
            success: true,
            message: 'Request submitted and is processing',
            optimistic: true,
            action: action
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...CorsMiddleware.buildHeaders() }
          });
        }

        const response = await this.proxyToBackend(request, action, method, false, urlObj, tenantId, {}, bodyText);

        if (response.ok) {
          const invalidatePatterns = CacheConfig.getInvalidatePatterns(action);
          if (invalidatePatterns.length > 0) {
            await this.kvHandler.invalidateByPattern(tenantId, invalidatePatterns);
          }
        }

        return response;
      },

      async proxyToBackend(request, action, method, isCacheable, urlObj, tenantId, queryParams = {}, requestBody = null) {
        const scriptUrl = this.env.SCRIPT_URL;
        if (!scriptUrl) {
          return this.responseHandler.noBackend();
        }

        const headers = this.buildHeaders(request);
        const body = requestBody || await RequestParser.parseBody(request);
        const token = AuthMiddleware.extractToken(request);
        const bodyWithToken = AuthMiddleware.addTokenToBody(body, token);

        const fetchOptions = {
          method,
          headers: { 'Content-Type': 'application/json', ...headers }
        };

        if (bodyWithToken) {
          fetchOptions.body = bodyWithToken;
        }

        try {
          // Broad Caching: If action is broad, strip domain filters but PRESERVE authentication token
          const isBroad = isCacheable && (method === 'GET' || CacheConfig.isPostReadAction(action)) && CacheConfig.isBroad(action);

          let backendParams;
          if (isBroad) {
            backendParams = new URLSearchParams();
            const tokenInQuery = urlObj.searchParams.get('token');
            if (tokenInQuery) backendParams.set('token', tokenInQuery);
          } else {
            backendParams = urlObj.searchParams;
          }

          const apiUrl = RequestParser.buildApiUrl(scriptUrl, action, backendParams);
          const response = await fetch(apiUrl, fetchOptions);

          if (isCacheable && response.ok && (method === 'GET' || CacheConfig.isPostReadAction(action))) {
            const data = await response.clone().json();

            // STRICTER GUARD: Never cache if success is false or if it looks like an error
            const isValidData = data && data.success !== false && !data.error;
            const hasData = Array.isArray(data) ? data.length > 0 : (data && Object.keys(data).length > 0);

            if (isValidData && hasData) {
              const cacheKey = this.kvHandler.buildKeyForAction(tenantId, action, {
                token,
                queryParams: isBroad ? {} : queryParams,
                body: isBroad ? null : (bodyWithToken || body)
              });
              await this.kvHandler.setByKey(cacheKey, data, action);
            }

            // If it was a broad fetch and it's valid, return filtered version
            if (isBroad && isValidData) {
              const filteredData = this.kvHandler.filterData(data, queryParams);
              const result = this.kvHandler.buildResponse(filteredData, false);
              return new Response(JSON.stringify(result), {
                status: 200,
                headers: {
                  'Content-Type': 'application/json',
                  'X-Cache': 'MISS',
                  'X-Cache-Key': 'MASTER_POPULATED',
                  ...CorsMiddleware.buildHeaders()
                }
              });
            }
          }

          return await this.responseHandler.handle(response, request, action, false);
        } catch (error) {
          return this.responseHandler.serverError(error.message);
        }
      },

      buildHeaders(request) {
        const headers = {};
        request.headers.forEach((value, key) => {
          if (key.toLowerCase() !== 'host' &&
            key.toLowerCase() !== 'if-none-match') {
            headers[key] = value;
          }
        });
        return headers;
      }
    };
  }
};

export default {
  async fetch(request, env, ctx) {
    const tenantId = env.TENANT_ID || '{TENANT_ID_DEFAULT}';
    console.log(`[${tenantId}] ${request.method} ${request.url}`);

    const router = Router.create(env, ctx);
    return await router.route(request);
  }
};
