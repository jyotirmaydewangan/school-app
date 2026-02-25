const SHEET_NAMES = Object.freeze({
  CONFIG: 'config',
  USERS: 'users',
  SESSIONS: 'sessions',
  ROLES: 'roles'
});

const ROLE_PERMISSIONS = Object.freeze({
  admin: ['*'],
  teacher: ['read:students', 'write:grades'],
  parent: ['read:own_child'],
  student: ['read:own_grades']
});

const SheetService = {
  getSheet(name) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(name);
    
    if (!sheet) {
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

  initializeSheet(name, sheet) {
    const schemas = {
      [SHEET_NAMES.USERS]: ['id', 'email', 'phone', 'password_hash', 'role', 'name', 'created_at', 'updated_at'],
      [SHEET_NAMES.SESSIONS]: ['session_id', 'user_id', 'expires_at', 'last_activity', 'created_at'],
      [SHEET_NAMES.CONFIG]: ['key', 'value'],
      [SHEET_NAMES.ROLES]: ['role_id', 'role_name', 'permissions', 'is_active']
    };
    
    if (schemas[name]) {
      sheet.appendRow(schemas[name]);
    }
  },

  seedDefaultRoles(sheet) {
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      const defaults = [
        [Utilities.getUuid(), 'admin', JSON.stringify(['*']), true],
        [Utilities.getUuid(), 'teacher', JSON.stringify(['read:students', 'write:grades']), true],
        [Utilities.getUuid(), 'parent', JSON.stringify(['read:own_child']), true],
        [Utilities.getUuid(), 'student', JSON.stringify(['read:own_grades']), true]
      ];
      defaults.forEach(row => sheet.appendRow(row));
    }
  },

  seedDefaultConfig(sheet) {
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      const defaults = [
        ['protected_role', 'admin,teacher,parent,student']
      ];
      defaults.forEach(row => sheet.appendRow(row));
    }
  }
};
