import { CorsMiddleware } from '../middleware/CorsMiddleware.js';
import { CacheHandler } from '../cache/CacheHandler.js';

export const ResponseHandler = {
  init(caches) {
    CacheHandler.init(caches);
    return this;
  },

  async handle(response, request, action, isCacheable) {
    const responseText = await response.text();
    let headers;

    if (isCacheable) {
      headers = CorsMiddleware.addHeaders(response);
      headers.set('X-Cache', 'MISS');
      
      const cachedResponse = new Response(responseText, {
        status: response.status,
        headers
      });
      
      await CacheHandler.set(request, cachedResponse, action);
      return cachedResponse;
    }

    if (['POST', 'PUT', 'DELETE'].includes(request.method)) {
      headers = CorsMiddleware.noCache(response);
    } else {
      headers = CorsMiddleware.addHeaders(response);
    }

    return new Response(responseText, {
      status: response.status,
      headers
    });
  },

  error(status, message) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: message 
    }), {
      status,
      headers: CorsMiddleware.handleOptions()
    });
  },

  serverError(message) {
    return this.error(502, 'Backend request failed: ' + message);
  },

  notFound(action) {
    return this.error(404, `Unknown action: ${action}`);
  },

  noBackend() {
    return this.error(500, 'Backend not configured');
  }
};
