const CACHE_TTL = Object.freeze({
  users: 2592000,
  config: 2592000,
  roles: 2592000,
  attendance: 604800,
  noticeboard: 604800,
  timetable: 2592000,
  marks: 604800,
  verify: 900,
  default: 2592000
});

const POST_READ_ACTIONS = [
  'getUsers',
  'getRoles',
  'getConfig',
  'getAttendance',
  'getNoticeboard',
  'getTimetable',
  'getMarks',
  'verify'
];

const CACHE_INVALIDATION_MAP = {
  'register': ['getUsers', 'users', 'verify'],
  'login': ['verify'],
  'logout': ['verify'],
  'verify': [],
  'getUsers': [],
  'getRoles': [],
  'getConfig': [],
  'createRole': ['getRoles', 'roles', 'getUsers', 'users', 'verify'],
  'updateRole': ['getRoles', 'roles', 'getUsers', 'users', 'verify'],
  'deleteRole': ['getRoles', 'roles', 'getUsers', 'users', 'verify'],
  'updateUserRole': ['getUsers', 'users', 'verify'],
  'createUser': ['getUsers', 'users', 'verify'],
  'updateUser': ['getUsers', 'users', 'verify'],
  'deleteUser': ['getUsers', 'users', 'verify'],
  'createAttendance': ['getAttendance', 'attendance'],
  'updateAttendance': ['getAttendance', 'attendance'],
  'createNoticeboard': ['getNoticeboard', 'noticeboard'],
  'updateNoticeboard': ['getNoticeboard', 'noticeboard'],
  'createTimetable': ['getTimetable', 'timetable'],
  'updateTimetable': ['getTimetable', 'timetable'],
  'createMarks': ['getMarks', 'marks'],
  'updateMarks': ['getMarks', 'marks']
};

export const CacheConfig = {
  getTTL(action) {
    const ttlMap = {
      attendance: CACHE_TTL.attendance,
      noticeboard: CACHE_TTL.noticeboard,
      timetable: CACHE_TTL.timetable,
      marks: CACHE_TTL.marks,
      users: CACHE_TTL.users,
      roles: CACHE_TTL.roles,
      config: CACHE_TTL.config,
      verify: CACHE_TTL.verify
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
      'getNoticeboard', 'getTimetable', 'getMarks', 'verify',
      'users', 'roles', 'config', 'attendance',
      'noticeboard', 'timetable', 'marks'
    ].map(s => s.toLowerCase());
    return cacheable.includes(action.toLowerCase());
  },

  isPostReadAction(action) {
    const normalizedAction = action.toLowerCase();
    return POST_READ_ACTIONS.some(a => a.toLowerCase() === normalizedAction);
  },

  getInvalidatePatterns(action) {
    return CACHE_INVALIDATION_MAP[action] || [];
  }
};
