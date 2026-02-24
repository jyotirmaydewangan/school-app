const CACHE_DEFAULTS = {
  users: 300,
  config: 3600,
  roles: 600,
  attendance: 300,
  noticeboard: 600,
  timetable: 3600,
  marks: 300,
  default: 60
};

export const CacheConfig = {
  getTTL(action) {
    const env = globalThis.workerEnv || {};
    
    const ttlMap = {
      attendance: env.CACHE_TTL_ATTENDANCE || env.DEFAULT_CACHE_TTL || CACHE_DEFAULTS.attendance,
      noticeboard: env.CACHE_TTL_NOTICEBOARD || env.DEFAULT_CACHE_TTL || CACHE_DEFAULTS.noticeboard,
      timetable: env.CACHE_TTL_TIMETABLE || env.DEFAULT_CACHE_TTL || CACHE_DEFAULTS.timetable,
      marks: env.CACHE_TTL_MARKS || env.DEFAULT_CACHE_TTL || CACHE_DEFAULTS.marks,
      users: env.CACHE_TTL_USERS || env.DEFAULT_CACHE_TTL || CACHE_DEFAULTS.users,
      roles: env.CACHE_TTL_ROLES || env.DEFAULT_CACHE_TTL || CACHE_DEFAULTS.roles,
      config: env.CACHE_TTL_CONFIG || env.DEFAULT_CACHE_TTL || CACHE_DEFAULTS.config
    };

    for (const [key, value] of Object.entries(ttlMap)) {
      if (action.includes(key)) return parseInt(value);
    }
    return parseInt(env.DEFAULT_CACHE_TTL) || CACHE_DEFAULTS.default;
  },

  shouldCache(action) {
    const cacheable = [
      'getUsers', 'getRoles', 'getConfig', 'getAttendance',
      'getNoticeboard', 'getTimetable', 'getMarks',
      'users', 'roles', 'config', 'attendance',
      'noticeboard', 'timetable', 'marks'
    ];
    return cacheable.includes(action);
  }
};
