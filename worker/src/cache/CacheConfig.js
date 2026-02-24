const CACHE_TTL = Object.freeze({
  users: 2592000,
  config: 2592000,
  roles: 2592000,
  attendance: 604800,
  noticeboard: 604800,
  timetable: 2592000,
  marks: 604800,
  default: 2592000
});

export const CacheConfig = {
  getTTL(action) {
    const ttlMap = {
      attendance: CACHE_TTL.attendance,
      noticeboard: CACHE_TTL.noticeboard,
      timetable: CACHE_TTL.timetable,
      marks: CACHE_TTL.marks,
      users: CACHE_TTL.users,
      roles: CACHE_TTL.roles,
      config: CACHE_TTL.config
    };

    const normalizedAction = action.toLowerCase();
    for (const [key, value] of Object.entries(ttlMap)) {
      if (normalizedAction.includes(key.toLowerCase())) {
        return typeof value === 'function' ? value() : value;
      }
    }
    const defaultValue = CACHE_TTL.default;
    return typeof defaultValue === 'function' ? defaultValue() : defaultValue;
  },

  shouldCache(action) {
    const cacheable = [
      'getUsers', 'getRoles', 'getConfig', 'getAttendance',
      'getNoticeboard', 'getTimetable', 'getMarks',
      'users', 'roles', 'config', 'attendance',
      'noticeboard', 'timetable', 'marks'
    ].map(s => s.toLowerCase());
    return cacheable.includes(action.toLowerCase());
  }
};
