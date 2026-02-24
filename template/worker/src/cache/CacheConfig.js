const CACHE_TTL = {
  users: () => parseInt(globalThis.workerEnv?.CACHE_TTL_USERS) || 2592000,
  config: () => parseInt(globalThis.workerEnv?.CACHE_TTL_CONFIG) || 2592000,
  roles: () => parseInt(globalThis.workerEnv?.CACHE_TTL_ROLES) || 2592000,
  attendance: () => parseInt(globalThis.workerEnv?.CACHE_TTL_ATTENDANCE) || 604800,
  noticeboard: () => parseInt(globalThis.workerEnv?.CACHE_TTL_NOTICEBOARD) || 604800,
  timetable: () => parseInt(globalThis.workerEnv?.CACHE_TTL_TIMETABLE) || 2592000,
  marks: () => parseInt(globalThis.workerEnv?.CACHE_TTL_MARKS) || 604800,
  verify: () => parseInt(globalThis.workerEnv?.CACHE_TTL_VERIFY) || 900,
  default: () => 2592000
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
    const normalizedAction = action.toLowerCase();
    for (const [key, value] of Object.entries(CACHE_TTL)) {
      if (key !== 'default' && normalizedAction.includes(key.toLowerCase())) {
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
