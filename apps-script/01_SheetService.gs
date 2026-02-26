const SHEET_NAMES = Object.freeze({
  CONFIG: 'config',
  USERS: 'users',
  SESSIONS: 'sessions',
  ROLES: 'roles',
  STUDENTS: 'students',
  PARENT_STUDENTS: 'parent_students',
  SUBJECTS: 'subjects',
  EXAMS: 'exams',
  MARKS: 'marks',
  TIMETABLE: 'timetable',
  SYLLABUS: 'syllabus',
  RESOURCES: 'resources',
  CLASS_INDEX: 'class_index',
  CLASSES: 'classes'
});

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Initialize')
    .addItem('Setup Sheets', 'SheetService.initializeAll')
    .addToUi();
  SheetService.initializeAll();
}

function getRolePermissions() {
  try {
    if (TENANT_CONFIG.ROLES) {
      return TENANT_CONFIG.ROLES;
    }
  } catch (e) {}
  return {
    admin: { permissions: ['*'], isActive: true },
    teacher: { permissions: ['read:students', 'write:grades'], isActive: true },
    parent: { permissions: ['read:own_child'], isActive: true },
    student: { permissions: ['read:own_grades'], isActive: true }
  };
}

function getDefaultRole() {
  try {
    return TENANT_CONFIG.DEFAULT_ROLE || 'student';
  } catch (e) {
    return 'student';
  }
}

function getSessionTimeout() {
  try {
    return TENANT_CONFIG.SESSION_TIMEOUT_MINUTES || 30;
  } catch (e) {
    return 30;
  }
}

const SheetService = {
  getSheet(name) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      Logger.log('Error: Could not get active spreadsheet. Is the script bound correctly?');
      throw new Error('Could not get active spreadsheet. Please ensure the script is bound to a Google Sheet.');
    }
    let sheet = ss.getSheetByName(name);
    
    if (!sheet) {
      Logger.log('Creating missing sheet: ' + name);
      sheet = ss.insertSheet(name);
      this.initializeSheet(name, sheet);
    }
    
    if (name === SHEET_NAMES.ROLES) {
      this.seedDefaultRoles(sheet);
    }

    if (name === SHEET_NAMES.CONFIG) {
      this.seedDefaultConfig(sheet);
    }
    
    return sheet;
  },

  initializeAll() {
    Logger.log('Starting SheetService.initializeAll()');
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      Logger.log('Error: ss is null');
      return { success: false, error: 'Could not get active spreadsheet' };
    }

    const sheetNames = [
      SHEET_NAMES.CONFIG, 
      SHEET_NAMES.USERS, 
      SHEET_NAMES.SESSIONS, 
      SHEET_NAMES.ROLES,
      SHEET_NAMES.STUDENTS,
      SHEET_NAMES.PARENT_STUDENTS,
      SHEET_NAMES.SUBJECTS,
      SHEET_NAMES.EXAMS,
      SHEET_NAMES.MARKS,
      SHEET_NAMES.TIMETABLE,
      SHEET_NAMES.SYLLABUS,
      SHEET_NAMES.RESOURCES,
      SHEET_NAMES.CLASS_INDEX,
      SHEET_NAMES.CLASSES
    ];
    
    sheetNames.forEach(name => {
      let sheet = ss.getSheetByName(name);
      if (!sheet) {
        Logger.log('Inserting sheet: ' + name);
        sheet = ss.insertSheet(name);
        this.initializeSheet(name, sheet);
      }
    });
    
    try {
      const rolesSheet = ss.getSheetByName(SHEET_NAMES.ROLES);
      this.seedDefaultRoles(rolesSheet);
    } catch (e) {
      Logger.log('Error seeding roles: ' + e.message);
    }
    
    try {
      const configSheet = ss.getSheetByName(SHEET_NAMES.CONFIG);
      this.seedDefaultConfig(configSheet);
    } catch (e) {
      Logger.log('Error seeding config: ' + e.message);
    }
    
    Logger.log('Initialization complete');
    return { success: true, message: 'All sheets initialized' };
  },

  initializeSheet(name, sheet) {
    Logger.log('Initializing schema for: ' + name);
    const schemas = {
      [SHEET_NAMES.USERS]: ['id', 'email', 'phone', 'password_hash', 'role', 'name', 'is_approved', 'rejected_at', 'created_at', 'updated_at'],
      [SHEET_NAMES.SESSIONS]: ['session_id', 'user_id', 'expires_at', 'last_activity', 'created_at'],
      [SHEET_NAMES.CONFIG]: ['key', 'value'],
      [SHEET_NAMES.ROLES]: ['role_id', 'role_name', 'permissions', 'is_active'],
      [SHEET_NAMES.STUDENTS]: ['id', 'user_id', 'admission_no', 'name', 'class', 'section', 'parent_phone1', 'parent_phone2', 'status', 'created_at', 'updated_at'],
      [SHEET_NAMES.PARENT_STUDENTS]: ['id', 'parent_id', 'student_id', 'linked_at'],
      [SHEET_NAMES.SUBJECTS]: ['id', 'name', 'class', 'teacher_id', 'created_at'],
      [SHEET_NAMES.EXAMS]: ['id', 'name', 'class', 'section', 'subject_id', 'date', 'max_marks', 'created_at'],
      [SHEET_NAMES.MARKS]: ['id', 'exam_id', 'student_id', 'marks_obtained', 'created_at'],
      [SHEET_NAMES.TIMETABLE]: ['id', 'class', 'section', 'day', 'period', 'start_time', 'end_time', 'subject_id', 'teacher_id', 'room'],
      [SHEET_NAMES.SYLLABUS]: ['id', 'class', 'subject_id', 'topic', 'description', 'status', 'created_at'],
      [SHEET_NAMES.RESOURCES]: ['id', 'class', 'subject_id', 'title', 'type', 'drive_file_id', 'drive_url', 'created_at'],
      [SHEET_NAMES.CLASS_INDEX]: ['student_id', 'class', 'section', 'admission_no', 'name'],
      [SHEET_NAMES.CLASSES]: ['id', 'name', 'section', 'stream', 'academic_year', 'is_active', 'created_at']
    };
    
    if (schemas[name]) {
      sheet.appendRow(schemas[name]);
      SpreadsheetApp.flush();
    }
  },

  seedDefaultRoles(sheet) {
    if (!sheet) {
      Logger.log('seedDefaultRoles: No sheet provided');
      return;
    }
    let data = sheet.getDataRange().getValues();
    if (!data || data.length === 0 || (data.length === 1 && (!data[0][0] || data[0][0] === ''))) {
      Logger.log('seedDefaultRoles: Sheet empty, adding headers');
      sheet.appendRow(['role_id', 'role_name', 'permissions', 'is_active']);
      SpreadsheetApp.flush();
      data = sheet.getDataRange().getValues();
    }
    
    const existingRoles = data.slice(1)
      .filter(row => row && row[1] && String(row[1]).trim() !== '')
      .map(row => String(row[1]).trim());
    
    Logger.log('existingRoles: ' + JSON.stringify(existingRoles));
    
    if (existingRoles.length === 0) {
      Logger.log('seedDefaultRoles: Seeding default roles');
      const roles = getRolePermissions();
      if (roles && Object.keys(roles).length > 0) {
        const defaults = Object.entries(roles).map(function(entry) {
          const roleName = entry[0];
          const roleData = entry[1];
          return [Utilities.getUuid(), roleName, JSON.stringify(roleData.permissions), roleData.isActive];
        });
        // Batch append rows using setValues if possible, but appendRow is fine for seeding
        defaults.forEach(function(row) {
          sheet.appendRow(row);
        });
      } else {
        Logger.log('No roles to seed');
      }
    }
  },

  seedDefaultConfig(sheet) {
    if (!sheet) {
      Logger.log('seedDefaultConfig: No sheet provided');
      return;
    }
    let data = sheet.getDataRange().getValues();
    if (!data || data.length === 0 || (data.length === 1 && (!data[0][0] || data[0][0] === ''))) {
      Logger.log('seedDefaultConfig: Sheet empty, adding headers');
      sheet.appendRow(['key', 'value']);
      SpreadsheetApp.flush();
      data = sheet.getDataRange().getValues();
    }
    
    const existingKeys = data.slice(1)
      .filter(row => row && row[0] && String(row[0]).trim() !== '')
      .map(row => String(row[0]).trim());
    
    Logger.log('existingKeys: ' + JSON.stringify(existingKeys));
    
    if (!existingKeys.includes('protected_role')) {
      Logger.log('Adding protected_role');
      sheet.appendRow(['protected_role', 'admin']);
    }
    if (!existingKeys.includes('session_timeout_minutes')) {
      Logger.log('Adding session_timeout_minutes');
      sheet.appendRow(['session_timeout_minutes', getSessionTimeout()]);
    }
    if (!existingKeys.includes('app_url')) {
      Logger.log('Adding app_url');
      sheet.appendRow(['app_url', '']);
    }
    if (!existingKeys.includes('jwt_secret')) {
      Logger.log('Adding jwt_secret');
      sheet.appendRow(['jwt_secret', 'sh-h-h-secret-' + Utilities.getUuid().substring(0, 8)]);
    }
  }
};
