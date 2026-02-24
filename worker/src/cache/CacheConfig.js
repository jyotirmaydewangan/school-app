const CACHE_TTL = Object.freeze({
  users: 300,
  config: 3600,
  roles: 600,
  attendance: 300,
  noticeboard: 600,
  timetable: 3600,
  marks: 300,
  default: 60
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

    for (const [key, value] of Object.entries(ttlMap)) {
      if (action.includes(key)) return value;
    }
    return CACHE_TTL.default;
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
