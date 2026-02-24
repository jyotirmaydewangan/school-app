const RoleRepository = {
  findByName(roleName) {
    const sheet = SheetService.getSheet(SHEET_NAMES.ROLES);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === roleName) {
        return this.mapToRole(data[i]);
      }
    }
    return null;
  },

  findById(roleId) {
    const sheet = SheetService.getSheet(SHEET_NAMES.ROLES);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === roleId) {
        return this.mapToRole(data[i]);
      }
    }
    return null;
  },

  findAll() {
    const sheet = SheetService.getSheet(SHEET_NAMES.ROLES);
    const data = sheet.getDataRange().getValues();
    const roles = [];
    
    for (let i = 1; i < data.length; i++) {
      roles.push(this.mapToRole(data[i]));
    }
    return roles;
  },

  findActive() {
    return this.findAll().filter(function(role) {
      return role.is_active;
    });
  },

  create(roleData) {
    const sheet = SheetService.getSheet(SHEET_NAMES.ROLES);
    const roleId = Utils.generateId();
    
    sheet.appendRow([
      roleId,
      roleData.role_name,
      JSON.stringify(roleData.permissions || []),
      roleData.is_active !== false
    ]);
    
    return this.findById(roleId);
  },

  update(roleId, roleData) {
    const sheet = SheetService.getSheet(SHEET_NAMES.ROLES);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === roleId) {
        if (roleData.role_name) sheet.getRange(i + 1, 2).setValue(roleData.role_name);
        if (roleData.permissions) sheet.getRange(i + 1, 3).setValue(JSON.stringify(roleData.permissions));
        if (roleData.is_active !== undefined) sheet.getRange(i + 1, 4).setValue(roleData.is_active);
        return true;
      }
    }
    return false;
  },

  delete(roleId) {
    const sheet = SheetService.getSheet(SHEET_NAMES.ROLES);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === roleId) {
        sheet.deleteRow(i + 1);
        return true;
      }
    }
    return false;
  },

  exists(roleName) {
    return this.findByName(roleName) !== null;
  },

  isProtected(roleName) {
    const protectedRoles = ['admin', 'teacher', 'parent', 'student'];
    return protectedRoles.includes(roleName);
  },

  mapToRole(row) {
    return {
      role_id: row[0],
      role_name: row[1],
      permissions: Utils.parseJson(row[2]),
      is_active: row[3]
    };
  }
};
