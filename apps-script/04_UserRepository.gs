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
    
    const isApproved = userData.role === 'admin' || userData.is_approved === true;
    
    sheet.appendRow([
      id,
      userData.email,
      userData.phone || '',
      userData.password_hash,
      userData.role || 'student',
      userData.name,
      isApproved,
      '',
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

  update(userId, userData) {
    const sheet = SheetService.getSheet(SHEET_NAMES.USERS);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === userId) {
        const row = i + 1;
        const now = Utils.getCurrentTimestamp();
        
        // Batch updates to reduce API calls
        // Columns: 3:phone, 4:password_hash, 5:role, 6:name, 8:updated_at
        if (userData.phone !== undefined) sheet.getRange(row, 3).setValue(userData.phone || '');
        if (userData.password_hash) sheet.getRange(row, 4).setValue(userData.password_hash);
        if (userData.role) sheet.getRange(row, 5).setValue(userData.role);
        if (userData.name) sheet.getRange(row, 6).setValue(userData.name);
        
        // Always update the timestamp
        sheet.getRange(row, 8).setValue(now);
        
        return this.findById(userId);
      }
    }
    return null;
  },

  delete(userId) {
    const sheet = SheetService.getSheet(SHEET_NAMES.USERS);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === userId) {
        sheet.deleteRow(i + 1);
        return true;
      }
    }
    return false;
  },

  existsByEmail(email) {
    return this.findByEmail(email) !== null;
  },

  findPending(options = {}) {
    const sheet = SheetService.getSheet(SHEET_NAMES.USERS);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const pendingUsers = [];
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0]) {
        const isApproved = data[i][6];
        const rejectedAt = data[i][7];
        if (!isApproved && !rejectedAt) {
          pendingUsers.push(this.mapRowToUser(headers, data[i]));
        }
      }
    }
    
    let filtered = pendingUsers;
    
    if (options.role) {
      filtered = filtered.filter(u => u.role === options.role);
    }
    
    const total = filtered.length;
    
    if (options.limit && options.limit > 0) {
      const offset = options.offset || 0;
      filtered = filtered.slice(offset, offset + options.limit);
    }
    
    return {
      users: filtered,
      total: total
    };
  },

  findRejected(options = {}) {
    const sheet = SheetService.getSheet(SHEET_NAMES.USERS);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const rejectedUsers = [];
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0]) {
        const isApproved = data[i][6];
        const rejectedAt = data[i][7];
        if (!isApproved && rejectedAt) {
          rejectedUsers.push(this.mapRowToUser(headers, data[i]));
        }
      }
    }
    
    const total = rejectedUsers.length;
    
    if (options.limit && options.limit > 0) {
      const offset = options.offset || 0;
      return rejectedUsers.slice(offset, offset + options.limit);
    }
    
    return {
      users: rejectedUsers,
      total: total
    };
  },

  approveUser(userId) {
    const sheet = SheetService.getSheet(SHEET_NAMES.USERS);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === userId) {
        sheet.getRange(i + 1, 7).setValue(true);
        sheet.getRange(i + 1, 8).setValue('');
        sheet.getRange(i + 1, 10).setValue(Utils.getCurrentTimestamp());
        return this.findById(userId);
      }
    }
    return null;
  },

  rejectUser(userId) {
    const sheet = SheetService.getSheet(SHEET_NAMES.USERS);
    const data = sheet.getDataRange().getValues();
    const now = Utils.getCurrentTimestamp();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === userId) {
        sheet.getRange(i + 1, 7).setValue(false);
        sheet.getRange(i + 1, 8).setValue(now);
        sheet.getRange(i + 1, 10).setValue(now);
        return this.findById(userId);
      }
    }
    return null;
  },

  countPending() {
    const sheet = SheetService.getSheet(SHEET_NAMES.USERS);
    const data = sheet.getDataRange().getValues();
    let count = 0;
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0]) {
        const isApproved = data[i][6];
        const rejectedAt = data[i][7];
        if (!isApproved && !rejectedAt) {
          count++;
        }
      }
    }
    return count;
  },

  mapToUser(row) {
    return {
      id: row[0],
      email: row[1],
      phone: row[2],
      password_hash: row[3],
      role: row[4],
      name: row[5],
      is_approved: row[6],
      rejected_at: row[7],
      created_at: row[8],
      updated_at: row[9]
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
