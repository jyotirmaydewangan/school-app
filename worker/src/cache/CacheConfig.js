export const CACHE_SCOPES = Object.freeze({
  GLOBAL: 'GLOBAL',
  USER: 'USER',
  SESSION: 'SESSION'
});

const CACHE_RULES = {
  'getConfig': { scope: CACHE_SCOPES.GLOBAL, ttl: 2592000 },
  'getRoles': { scope: CACHE_SCOPES.GLOBAL, ttl: 2592000 },
  'getUsers': { scope: CACHE_SCOPES.GLOBAL, ttl: 2592000 },
  'getAttendance': { scope: CACHE_SCOPES.USER, ttl: 604800 },
  'getNoticeboard': { scope: CACHE_SCOPES.GLOBAL, ttl: 604800 },
  'getTimetable': { scope: CACHE_SCOPES.GLOBAL, ttl: 2592000 },
  'getMarks': { scope: CACHE_SCOPES.USER, ttl: 604800 },
  'verify': { scope: CACHE_SCOPES.SESSION, ttl: 900 }
};

const CACHE_INVALIDATION_MAP = {
  'register': ['getUsers', 'verify'],
  'login': ['verify'],
  'logout': ['verify'],
  'createRole': ['getRoles', 'getUsers', 'verify'],
  'updateRole': ['getRoles', 'getUsers', 'verify'],
  'deleteRole': ['getRoles', 'getUsers', 'verify'],
  'updateUserRole': ['getUsers', 'verify'],
  'createUser': ['getUsers', 'verify'],
  'updateUser': ['getUsers', 'verify'],
  'deleteUser': ['getUsers', 'verify'],
  'createAttendance': ['getAttendance'],
  'updateAttendance': ['getAttendance'],
  'createNoticeboard': ['getNoticeboard'],
  'updateNoticeboard': ['getNoticeboard'],
  'createTimetable': ['getTimetable'],
  'updateTimetable': ['getTimetable'],
  'createMarks': ['getMarks'],
  'updateMarks': ['getMarks']
};

export const CacheConfig = {
  getRule(action) {
    const normalizedAction = action.toLowerCase();
    const actionKey = Object.keys(CACHE_RULES).find(key => key.toLowerCase() === normalizedAction);
    return actionKey ? CACHE_RULES[actionKey] : null;
  },

  getTTL(action) {
    const rule = this.getRule(action);
    return rule ? rule.ttl : 2592000; // Default 1 month
  },

  getScope(action) {
    const rule = this.getRule(action);
    return rule ? rule.scope : CACHE_SCOPES.GLOBAL;
  },

  shouldCache(action) {
    return !!this.getRule(action);
  },

  isPostReadAction(action) {
    return !!this.getRule(action);
  },

  getInvalidatePatterns(action) {
    return CACHE_INVALIDATION_MAP[action] || [];
  }
};
