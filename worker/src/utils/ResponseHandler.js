import { CorsMiddleware } from '../middleware/CorsMiddleware.js';
import { CacheHandler } from '../cache/CacheHandler.js';
import { CacheConfig } from '../cache/CacheConfig.js';

export const ResponseHandler = {
  init(caches) {
    CacheHandler.init(caches);
    return this;
  },

  async handle(response, request, action, isCacheable) {
    const responseText = await response.text();
    let headers;
    let status = response.status;

    // Fix: If backend says token expired but returns 200 (Apps Script quirk), 
    // force a 401 so the frontend triggers re-login.
    if (status === 200 && responseText && responseText.includes('Token expired')) {
      status = 401;
    }

    if (isCacheable) {
      headers = CorsMiddleware.addHeaders(response);
      headers.set('X-Cache', 'MISS');

      const isEmptyResponse = !responseText || responseText.trim() === '' || responseText === 'null';
      const shouldNotCache = isEmptyResponse || status >= 400;

      if (!shouldNotCache) {
        const cachedResponse = new Response(responseText, {
          status: status,
          headers
        });

        await CacheHandler.set(request, cachedResponse, action);
        return cachedResponse;
      }

      return new Response(responseText, {
        status: status,
        headers
      });
    }

    if (['POST', 'PUT', 'DELETE'].includes(request.method)) {
      headers = CorsMiddleware.noCache(response);
    } else {
      headers = CorsMiddleware.addHeaders(response);
    }

    return new Response(responseText, {
      status: status,
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
