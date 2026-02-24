const UserRepository = {
  findByEmail(email) {
    const sheet = SheetService.getSheet(SHEET_NAMES.USERS);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === email) {
        return this.mapToUser(data[i]);
      }
    }
    return null;
  },

  findById(id) {
    const sheet = SheetService.getSheet(SHEET_NAMES.USERS);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === id) {
        return this.mapToUser(data[i]);
      }
    }
    return null;
  },

  findAll(options = {}) {
    const sheet = SheetService.getSheet(SHEET_NAMES.USERS);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const allUsers = [];
    
    for (let i = 1; i < data.length; i++) {
      allUsers.push(this.mapRowToUser(headers, data[i]));
    }
    
    const total = allUsers.length;
    let paginatedUsers = allUsers;
    
    if (options.limit && options.limit > 0) {
      const offset = options.offset || 0;
      paginatedUsers = allUsers.slice(offset, offset + options.limit);
    }
    
    return {
      users: paginatedUsers,
      pagination: {
        total,
        limit: options.limit || 0,
        offset: options.offset || 0,
        has_more: options.limit > 0 && ((options.offset || 0) + options.limit) < total
      }
    };
  },

  create(userData) {
    const sheet = SheetService.getSheet(SHEET_NAMES.USERS);
    const id = Utils.generateId();
    const now = Utils.getCurrentTimestamp();
    
    sheet.appendRow([
      id,
      userData.email,
      userData.phone || '',
      userData.password_hash,
      userData.role || 'student',
      userData.name,
      now,
      now
    ]);
    
    return this.findById(id);
  },

  updateRole(userId, newRole) {
    const sheet = SheetService.getSheet(SHEET_NAMES.USERS);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === userId) {
        sheet.getRange(i + 1, 5).setValue(newRole);
        sheet.getRange(i + 1, 8).setValue(Utils.getCurrentTimestamp());
        return true;
      }
    }
    return false;
  },

  existsByEmail(email) {
    return this.findByEmail(email) !== null;
  },

  mapToUser(row) {
    return {
      id: row[0],
      email: row[1],
      phone: row[2],
      password_hash: row[3],
      role: row[4],
      name: row[5],
      created_at: row[6],
      updated_at: row[7]
    };
  },

  mapRowToUser(headers, row) {
    const user = {};
    headers.forEach(function(header, index) {
      user[header] = row[index];
    });
    delete user.password_hash;
    return user;
  }
};
