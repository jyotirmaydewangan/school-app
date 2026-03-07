class SyncManager {
  constructor() {
    this.timers = {};
    this.retries = {};
    this.MAX_RETRIES = 5;
    this.listeners = {};
    this.defaultInterval = 3000;
  }

  getInterval() {
    return window.TENANT_CONFIG?.SYNC_POLL_INTERVAL_MS || this.defaultInterval;
  }

  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(data));
    }
  }

  monitor(sourceId, items, refreshFn) {
    if (this.timers[sourceId]) {
      clearTimeout(this.timers[sourceId]);
      delete this.timers[sourceId];
    }

    if (!items || !Array.isArray(items)) {
      return;
    }

    const pendingItems = items.filter(item =>
      item._sync && (item._sync.status === 'pending' || item._sync.status === 'pending_delete')
    );

    if (pendingItems.length > 0) {
      this.retries[sourceId] = (this.retries[sourceId] || 0) + 1;

      if (this.retries[sourceId] > this.MAX_RETRIES) {
        console.warn(`[SyncManager] Max retries reached for ${sourceId}. Forcing recovery.`);
        pendingItems.forEach(item => {
          if (item._sync) item._sync.status = 'synced';
        });
        this.retries[sourceId] = 0;
        this.emit('maxRetriesReached', { sourceId, items: pendingItems });
        return;
      }

      const options = this.retries[sourceId] >= 3 ? { cache: 'false' } : {};
      
      this.timers[sourceId] = setTimeout(() => {
        this.emit('refresh', { sourceId, options });
        refreshFn(options);
      }, this.getInterval());
    } else {
      this.retries[sourceId] = 0;
    }
  }

  clear(sourceId) {
    if (this.timers[sourceId]) {
      clearTimeout(this.timers[sourceId]);
      delete this.timers[sourceId];
    }
    if (this.retries[sourceId]) {
      delete this.retries[sourceId];
    }
  }

  clearAll() {
    Object.keys(this.timers).forEach(id => this.clear(id));
  }

  init() {
    console.log('[SyncManager] Initialized with interval:', this.getInterval());
  }
}

const syncManager = new SyncManager();

if (typeof window !== 'undefined') {
  window.SyncManager = SyncManager;
  window.syncManager = syncManager;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SyncManager, syncManager };
}
