const SHEET_NAMES = Object.freeze({
  CONFIG: 'config',
  USERS: 'users',
  SESSIONS: 'sessions',
  ROLES: 'roles'
});

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

  initializeAll() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetNames = [SHEET_NAMES.CONFIG, SHEET_NAMES.USERS, SHEET_NAMES.SESSIONS, SHEET_NAMES.ROLES];
    
    sheetNames.forEach(name => {
      let sheet = ss.getSheetByName(name);
      if (!sheet) {
        sheet = ss.insertSheet(name);
        this.initializeSheet(name, sheet);
      }
    });
    
    this.getSheet(SHEET_NAMES.ROLES);
    
    const configSheet = this.getSheet(SHEET_NAMES.CONFIG);
    const configData = configSheet.getDataRange().getValues();
    if (configData.length <= 1) {
      configSheet.appendRow(['session_timeout_minutes', getSessionTimeout()]);
      configSheet.appendRow(['app_url', '']);
    }
    
    return { success: true, message: 'All sheets initialized' };
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
      const roles = getRolePermissions();
      const defaults = Object.entries(roles).map(function(entry) {
        const roleName = entry[0];
        const roleData = entry[1];
        return [Utilities.getUuid(), roleName, JSON.stringify(roleData.permissions), roleData.isActive];
      });
      defaults.forEach(function(row) {
        sheet.appendRow(row);
      });
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
