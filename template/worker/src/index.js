import { RouteConfig, RequestParser } from './routes/RouteConfig.js';
import { CorsMiddleware } from './middleware/CorsMiddleware.js';
import { AuthMiddleware } from './middleware/AuthMiddleware.js';
import { CacheConfig } from './cache/CacheConfig.js';
import { ResponseHandler } from './utils/ResponseHandler.js';

globalThis.workerEnv = {};

const Router = {
  create(env) {
    globalThis.workerEnv = env;
    return {
      env,
      responseHandler: ResponseHandler.init(caches.default),
      
      async route(request) {
        const { method, url } = request;
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        const action = RouteConfig.parsePath(pathname);

        const tenantId = this.env.TENANT_ID || 'unknown';
        console.log(`[${tenantId}] ${method} ${pathname}`);

        if (method === 'OPTIONS') {
          return CorsMiddleware.handleOptions();
        }

        if (!RouteConfig.shouldHandle(method)) {
          return this.responseHandler.notFound(action);
        }

        const isGetRequest = RouteConfig.isGetRequest(method);
        const isCacheable = isGetRequest && CacheConfig.shouldCache(action);

        if (isCacheable) {
          const cached = await caches.default.match(request);
          if (cached) {
            const response = cached.clone();
            response.headers.set('X-Cache', 'HIT');
            response.headers.set('X-Tenant-ID', tenantId);
            return response;
          }
        }

        return this.proxyToBackend(request, action, method, isCacheable, urlObj, tenantId);
      },

      async proxyToBackend(request, action, method, isCacheable, urlObj, tenantId) {
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
          return await this.responseHandler.handle(response, request, action, isCacheable);
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
