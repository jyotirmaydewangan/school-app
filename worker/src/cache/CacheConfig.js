export const CACHE_SCOPES = Object.freeze({
  GLOBAL: 'GLOBAL',
  USER: 'USER',
  SESSION: 'SESSION'
});

// TTL Constants (in seconds)
const ONE_MONTH = Number('{TTL_ONE_MONTH}') || 2592000;
const ONE_WEEK = Number('{TTL_ONE_WEEK}') || 604800;
const ONE_DAY = Number('{TTL_ONE_DAY}') || 86400;
const FIFTEEN_MIN = Number('{TTL_FIFTEEN_MIN}') || 900;
const ONE_MIN = Number('{TTL_ONE_MIN}') || 60;

/**
 * CACHE_POLICY defines the rules for every read action.
 */
const CACHE_POLICY = (function () {
  const injected = '{CACHE_POLICY_JSON}';
  if (injected === '{' + 'CACHE_POLICY_JSON}' || injected === '{}' || injected === '') return _getDefaultPolicy();
  try {
    return JSON.parse(injected);
  } catch (e) {
    return _getDefaultPolicy();
  }
})();

/**
 * Maps write actions to the read caches they must invalidate.
 */
const INVALIDATION_MAP = (function () {
  const injected = '{INVALIDATION_MAP_JSON}';
  if (injected === '{' + 'INVALIDATION_MAP_JSON}' || injected === '{}' || injected === '') return _getDefaultInvalidationMap();
  try {
    return JSON.parse(injected);
  } catch (e) {
    return _getDefaultInvalidationMap();
  }
})();

function _getDefaultPolicy() {
  return {
    'getConfig': { scope: CACHE_SCOPES.GLOBAL, ttl: ONE_WEEK, isBroad: true },
    'getSchools': { scope: CACHE_SCOPES.GLOBAL, ttl: ONE_MONTH, isBroad: true },
    'getClasses': { scope: CACHE_SCOPES.GLOBAL, ttl: ONE_DAY, isBroad: true },
    'getSections': { scope: CACHE_SCOPES.GLOBAL, ttl: ONE_MONTH, isBroad: true },
    'getRoles': { scope: CACHE_SCOPES.GLOBAL, ttl: ONE_MONTH, isBroad: true },
    'getSubjects': { scope: CACHE_SCOPES.GLOBAL, ttl: ONE_MONTH, isBroad: true },
    'getUsers': { scope: CACHE_SCOPES.GLOBAL, ttl: ONE_MONTH, isBroad: true },
    'getStudents': { scope: CACHE_SCOPES.GLOBAL, ttl: ONE_MONTH, isBroad: true },
    'getTimetable': { scope: CACHE_SCOPES.GLOBAL, ttl: ONE_WEEK, isBroad: true },
    'getExams': { scope: CACHE_SCOPES.GLOBAL, ttl: ONE_WEEK, isBroad: true },
    'getSyllabus': { scope: CACHE_SCOPES.GLOBAL, ttl: ONE_WEEK, isBroad: true },
    'getResources': { scope: CACHE_SCOPES.GLOBAL, ttl: ONE_WEEK, isBroad: true },
    'getNoticeboard': { scope: CACHE_SCOPES.GLOBAL, ttl: ONE_WEEK, isBroad: true },
    'getNotices': { scope: CACHE_SCOPES.GLOBAL, ttl: ONE_DAY, isBroad: true },
    'getDashboardStats': { scope: CACHE_SCOPES.GLOBAL, ttl: FIFTEEN_MIN, isBroad: true },
    'getAttendance': { scope: CACHE_SCOPES.USER, ttl: ONE_WEEK, isBroad: false },
    'getAttendanceByClass': { scope: CACHE_SCOPES.GLOBAL, ttl: ONE_WEEK * 2, isBroad: true, keyParameters: ['class', 'section', 'year', 'month'] },
    'getAttendanceByClassAndYear': { scope: CACHE_SCOPES.GLOBAL, ttl: ONE_DAY * 2, isBroad: true, keyParameters: ['class', 'section', 'year'] },
    'getAttendanceSummary': { scope: CACHE_SCOPES.GLOBAL, ttl: ONE_DAY, isBroad: false },
    'getMarks': { scope: CACHE_SCOPES.USER, ttl: ONE_WEEK, isBroad: false },
    'getLinkedStudents': { scope: CACHE_SCOPES.GLOBAL, ttl: ONE_MONTH, isBroad: true },
    'getLinkedParents': { scope: CACHE_SCOPES.USER, ttl: ONE_DAY, isBroad: false },
    'getPendingRegistrations': { scope: CACHE_SCOPES.GLOBAL, ttl: ONE_MIN, isBroad: true },
    'verify': { scope: CACHE_SCOPES.SESSION, ttl: FIFTEEN_MIN, isBroad: true }
  };
}

function _getDefaultInvalidationMap() {
  return {
    'register': ['getUsers', 'verify'],
    'login': ['verify'],
    'logout': ['verify'],
    'approveUser': ['getPendingRegistrations', 'getUsers'],
    'rejectUser': ['getPendingRegistrations'],
    'createUser': ['getUsers', 'verify'],
    'updateUser': ['getUsers', 'verify'],
    'deleteUser': ['getUsers', 'verify'],
    'updateUserRole': ['getUsers', 'verify'],
    'createRole': ['getRoles', 'getUsers', 'verify'],
    'updateRole': ['getRoles', 'getUsers', 'verify'],
    'deleteRole': ['getRoles', 'getUsers', 'verify'],
    'createSchool': ['getSchools'],
    'updateSchool': ['getSchools'],
    'deleteSchool': ['getSchools'],
    'createClass': ['getClasses'],
    'updateClass': ['getClasses'],
    'deleteClass': ['getClasses'],
    'createSection': ['getSections'],
    'updateSection': ['getSections'],
    'deleteSection': ['getSections'],
    'createStudent': ['getStudents', 'getDashboardStats'],
    'updateStudent': ['getStudents', 'getDashboardStats'],
    'deleteStudent': ['getStudents', 'getDashboardStats'],
    'approveStudent': ['getStudents', 'getDashboardStats'],
    'linkParentStudent': ['getLinkedStudents', 'getLinkedParents'],
    'autoLinkParents': ['getLinkedStudents', 'getLinkedParents'],
    'unlinkParentStudent': ['getLinkedStudents', 'getLinkedParents'],
    'markAttendance': ['getAttendance', 'getAttendanceByClass', 'getAttendanceByClassAndYear', 'getAttendanceSummary', 'getDashboardStats'],
    'createExam': ['getExams', 'getDashboardStats'],
    'updateExam': ['getExams'],
    'deleteExam': ['getExams'],
    'enterMarks': ['getMarks', 'getDashboardStats'],
    'calculateGrades': ['getMarks'],
    'setTimetable': ['getTimetable'],
    'deleteTimetable': ['getTimetable'],
    'createSubject': ['getSubjects'],
    'updateSubject': ['getSubjects'],
    'deleteSubject': ['getSubjects'],
    'addSyllabus': ['getSyllabus'],
    'updateSyllabus': ['getSyllabus'],
    'deleteSyllabus': ['getSyllabus'],
    'addResource': ['getResources'],
    'deleteResource': ['getResources'],
    'createNotice': ['getNotices', 'getDashboardStats'],
    'updateNotice': ['getNotices'],
    'deleteNotice': ['getNotices']
  };
}

export const CacheConfig = {
  getRule(action) {
    const normalizedAction = action.toLowerCase();
    const actionKey = Object.keys(CACHE_POLICY).find(key => key.toLowerCase() === normalizedAction);
    return actionKey ? CACHE_POLICY[actionKey] : null;
  },

  getTTL(action) {
    const rule = this.getRule(action);
    return rule ? rule.ttl : ONE_MONTH;
  },

  getScope(action) {
    const rule = this.getRule(action);
    return rule ? rule.scope : CACHE_SCOPES.GLOBAL;
  },

  shouldCache(action) {
    return !!this.getRule(action);
  },

  isBroad(action) {
    const rule = this.getRule(action);
    return rule ? rule.isBroad === true : false;
  },

  isPostReadAction(action) {
    return !!this.getRule(action);
  },

  getInvalidatePatterns(action) {
    return INVALIDATION_MAP[action] || [];
  }
};
