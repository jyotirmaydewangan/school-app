export const CACHE_SCOPES = Object.freeze({
  GLOBAL: 'GLOBAL',
  USER: 'USER',
  SESSION: 'SESSION'
});

// TTL Constants (in seconds)
const ONE_MONTH = 2592000;
const ONE_WEEK = 604800;
const ONE_DAY = 86400;
const FIFTEEN_MIN = 900;
const ONE_MIN = 60;

/**
 * CACHE_POLICY defines the rules for every read action.
 * isBroad: true = "Master List" caching (Worker filters in memory).
 * isBroad: false = "Hashed Specific" caching (Parameters part of the key).
 */
const CACHE_POLICY = {
  // --- Static/Hierarchical Data (Broad, High TTL) ---
  'getConfig': { scope: CACHE_SCOPES.GLOBAL, ttl: ONE_MONTH, isBroad: true },
  'getSchools': { scope: CACHE_SCOPES.GLOBAL, ttl: ONE_MONTH, isBroad: true },
  'getClasses': { scope: CACHE_SCOPES.GLOBAL, ttl: ONE_MONTH, isBroad: true },
  'getSections': { scope: CACHE_SCOPES.GLOBAL, ttl: ONE_MONTH, isBroad: true },
  'getRoles': { scope: CACHE_SCOPES.GLOBAL, ttl: ONE_MONTH, isBroad: true },
  'getSubjects': { scope: CACHE_SCOPES.GLOBAL, ttl: ONE_MONTH, isBroad: true },

  // --- Operational Data (Broad, High/Medium TTL) ---
  'getUsers': { scope: CACHE_SCOPES.GLOBAL, ttl: ONE_MONTH, isBroad: true },
  'getStudents': { scope: CACHE_SCOPES.GLOBAL, ttl: ONE_MONTH, isBroad: true },
  'getTimetable': { scope: CACHE_SCOPES.GLOBAL, ttl: ONE_WEEK, isBroad: true },
  'getExams': { scope: CACHE_SCOPES.GLOBAL, ttl: ONE_WEEK, isBroad: true },
  'getSyllabus': { scope: CACHE_SCOPES.GLOBAL, ttl: ONE_WEEK, isBroad: true },
  'getResources': { scope: CACHE_SCOPES.GLOBAL, ttl: ONE_WEEK, isBroad: true },
  'getNoticeboard': { scope: CACHE_SCOPES.GLOBAL, ttl: ONE_WEEK, isBroad: true },

  // --- Dynamic/Specific Data (Specific Hash, Medium/Short TTL) ---
  'getAttendance': { scope: CACHE_SCOPES.USER, ttl: ONE_WEEK, isBroad: false },
  'getAttendanceSummary': { scope: CACHE_SCOPES.USER, ttl: ONE_DAY, isBroad: false },
  'getMarks': { scope: CACHE_SCOPES.USER, ttl: ONE_WEEK, isBroad: false },
  'getLinkedStudents': { scope: CACHE_SCOPES.USER, ttl: ONE_DAY, isBroad: false },
  'getDashboardStats': { scope: CACHE_SCOPES.USER, ttl: FIFTEEN_MIN, isBroad: false },

  // --- System/Auth Data (Broad, Short TTL) ---
  'getPendingRegistrations': { scope: CACHE_SCOPES.GLOBAL, ttl: ONE_MIN, isBroad: true },
  'verify': { scope: CACHE_SCOPES.SESSION, ttl: FIFTEEN_MIN, isBroad: true }
};

/**
 * Maps write actions to the read caches they must invalidate.
 */
const INVALIDATION_MAP = {
  // Auth & Users
  'register': ['getUsers', 'verify'],
  'login': ['verify'],
  'logout': ['verify'],
  'approveUser': ['getPendingRegistrations', 'getUsers'],
  'rejectUser': ['getPendingRegistrations'],
  'createUser': ['getUsers', 'verify'],
  'updateUser': ['getUsers', 'verify'],
  'deleteUser': ['getUsers', 'verify'],
  'updateUserRole': ['getUsers', 'verify'],

  // Roles
  'createRole': ['getRoles', 'getUsers', 'verify'],
  'updateRole': ['getRoles', 'getUsers', 'verify'],
  'deleteRole': ['getRoles', 'getUsers', 'verify'],

  // Hierarchy
  'createSchool': ['getSchools'],
  'updateSchool': ['getSchools'],
  'deleteSchool': ['getSchools'],
  'createClass': ['getClasses'],
  'updateClass': ['getClasses'],
  'deleteClass': ['getClasses'],
  'createSection': ['getSections'],
  'updateSection': ['getSections'],
  'deleteSection': ['getSections'],

  // Student Lifecycle
  'createStudent': ['getStudents'],
  'updateStudent': ['getStudents', 'getLinkedStudents'],
  'deleteStudent': ['getStudents', 'getLinkedStudents'],
  'approveStudent': ['getStudents'],
  'linkParentStudent': ['getLinkedStudents'],
  'autoLinkParents': ['getLinkedStudents'],

  // Academic Ops
  'markAttendance': ['getAttendance', 'getAttendanceSummary', 'getDashboardStats'],
  'createExam': ['getExams', 'getDashboardStats'],
  'updateExam': ['getExams'],
  'deleteExam': ['getExams'],
  'enterMarks': ['getMarks', 'getDashboardStats'],
  'calculateGrades': ['getMarks'],
  'setTimetable': ['getTimetable'],
  'deleteTimetable': ['getTimetable'],

  // Curriculum
  'createSubject': ['getSubjects'],
  'updateSubject': ['getSubjects'],
  'deleteSubject': ['getSubjects'],
  'addSyllabus': ['getSyllabus'],
  'updateSyllabus': ['getSyllabus'],
  'deleteSyllabus': ['getSyllabus'],
  'addResource': ['getResources'],
  'deleteResource': ['getResources']
};

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
