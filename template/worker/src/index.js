import { RouteConfig, RequestParser } from './routes/RouteConfig.js';
import { CorsMiddleware } from './middleware/CorsMiddleware.js';
import { AuthMiddleware } from './middleware/AuthMiddleware.js';
import { CacheConfig } from './cache/CacheConfig.js';
import { KVCacheHandler } from './cache/KVCacheHandler.js';
import { ResponseHandler } from './utils/ResponseHandler.js';

globalThis.workerEnv = {};

const Router = {
  create(env) {
    globalThis.workerEnv = env;
    const kvHandler = KVCacheHandler.init(env);
    return {
      env,
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

        if (this.kvHandler.isEnabled() && isCacheable) {
          const cached = await this.kvHandler.get(tenantId, action, {});
          
          if (cached && !cached.isExpired) {
            if (cached.isStale) {
              this.refreshPostInBackground(tenantId, action, request);
              return this.kvHandler.buildResponse(cached.data, true);
            }
            return this.kvHandler.buildResponse(cached.data, false);
          }
        }

        return this.proxyToBackend(request, action, 'POST', isCacheable, urlObj, tenantId, {});
      },

      async refreshPostInBackground(tenantId, action, originalRequest) {
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
            await this.kvHandler.set(tenantId, action, data, {});
          }
        } catch (e) {
          // Silent fail for background refresh
        }
      },

      async handleReadRequest(request, action, method, urlObj, tenantId) {
        const isCacheable = CacheConfig.shouldCache(action);
        const queryParams = Object.fromEntries(urlObj.searchParams);

        if (this.kvHandler.isEnabled() && isCacheable) {
          const cached = await this.kvHandler.get(tenantId, action, queryParams);
          
          if (cached && !cached.isExpired) {
            if (cached.isStale) {
              this.refreshInBackground(tenantId, action, queryParams, request);
              return this.kvHandler.buildResponse(cached.data, true);
            }
            return this.kvHandler.buildResponse(cached.data, false);
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
            await this.kvHandler.set(tenantId, action, data, queryParams);
            console.log(`[KV] Background refresh completed for ${action}`);
          }
        } catch (e) {
          console.error(`[KV] Background refresh failed: ${e.message}`);
        }
      },

      async handleWriteRequest(request, action, method, urlObj, tenantId) {
        const response = await this.proxyToBackend(request, action, method, false, urlObj, tenantId);

        if (response.ok) {
          const invalidatePatterns = CacheConfig.getInvalidatePatterns(action);
          if (invalidatePatterns.length > 0) {
            await this.kvHandler.invalidateByPattern(tenantId, invalidatePatterns);
          }
        }

        return response;
      },

      async proxyToBackend(request, action, method, isCacheable, urlObj, tenantId, queryParams = {}) {
        const scriptUrl = this.env.SCRIPT_URL;
        if (!scriptUrl) {
          return this.responseHandler.noBackend();
        }

        const headers = this.buildHeaders(request);
        const body = await RequestParser.parseBody(request);
        const token = AuthMiddleware.extractToken(request);
        const bodyWithToken = AuthMiddleware.addTokenToBody(body, token);

        const apiUrl = RequestParser.buildApiUrl(scriptUrl, action, urlObj.searchParams);

        const fetchOptions = {
          method,
          headers: { 'Content-Type': 'application/json', ...headers }
        };

        if (bodyWithToken) {
          fetchOptions.body = bodyWithToken;
        }

        try {
          const response = await fetch(apiUrl, fetchOptions);
          
          if (isCacheable && response.ok && (method === 'GET' || CacheConfig.isPostReadAction(action))) {
            const data = await response.clone().json();
            if (data && (Array.isArray(data) ? data.length > 0 : Object.keys(data).length > 0)) {
              await this.kvHandler.set(tenantId, action, data, queryParams);
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
  async fetch(request, env) {
    const tenantId = env.TENANT_ID || 'unknown';
    console.log(`[${tenantId}] ${request.method} ${request.url}`);
    
    const router = Router.create(env);
    return await router.route(request);
  }
};
