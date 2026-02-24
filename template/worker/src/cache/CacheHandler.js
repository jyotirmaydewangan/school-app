import { CacheConfig } from './CacheConfig.js';

export const CacheHandler = {
  cache: null,

  init(caches) {
    this.cache = caches || caches.default;
    return this;
  },

  async get(request) {
    if (!this.cache) return null;
    return await this.cache.match(request);
  },

  async set(request, response, action) {
    if (!this.cache || !CacheConfig.shouldCache(action)) return;

    const ttl = CacheConfig.getTTL(action);
    const etag = this.generateETag(await response.clone().text());
    
    const headers = {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${ttl}, stale-while-revalidate=${ttl * 2}`,
      'ETag': etag,
      'X-Cache': 'MISS'
    };

    const newResponse = new Response(await response.text(), {
      status: response.status,
      headers
    });

    await this.cache.put(request, newResponse.clone());
    return newResponse;
  },

  generateETag(content) {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `"${hash.toString(16)}"`;
  }
};
