const CACHE_DEFAULTS = {
  users: 2592000,
  config: 2592000,
  roles: 2592000,
  attendance: 604800,
  noticeboard: 604800,
  timetable: 2592000,
  marks: 604800,
  verify: 900,
  default: 60
};

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
    const env = globalThis.workerEnv || {};
    
    const ttlMap = {
      verify: env.CACHE_TTL_VERIFY || CACHE_DEFAULTS.verify,
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
      'getNoticeboard', 'getTimetable', 'getMarks', 'verify',
      'users', 'roles', 'config', 'attendance',
      'noticeboard', 'timetable', 'marks'
    ];
    return cacheable.includes(action);
  },

  isPostReadAction(action) {
    return POST_READ_ACTIONS.includes(action);
  },

  getInvalidatePatterns(action) {
    return CACHE_INVALIDATION_MAP[action] || [];
  }
};
