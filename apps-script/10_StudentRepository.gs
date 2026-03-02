const StudentRepository = {
  findAll(options = {}) {
    const sheet = SheetService.getSheet(SHEET_NAMES.STUDENTS);
    const data = sheet.getDataRange().getValues();
    if (data.length === 0) return { students: [], total: 0 };
    
    const headers = data[0];
    const rows = data.slice(1);
    
    let students = rows.map(row => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = row[i]);
      return obj;
    }).filter(s => s.id && s.name);
    
    if (options.class_id) {
      students = students.filter(s => String(s.class_id) === String(options.class_id));
    }
    
    if (options.section_id) {
      students = students.filter(s => String(s.section_id) === String(options.section_id));
    }
    
    if (options.status) {
      students = students.filter(s => s.status === options.status);
    }
    
    const total = students.length;
    
    if (options.offset) {
      students = students.slice(options.offset);
    }
    if (options.limit) {
      students = students.slice(0, options.limit);
    }
    
    return { students, total };
  },

  findById(id) {
    const sheet = SheetService.getSheet(SHEET_NAMES.STUDENTS);
    const data = sheet.getDataRange().getValues();
    if (data.length === 0) return null;
    
    const headers = data[0];
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(id)) {
        const obj = {};
        headers.forEach((h, j) => obj[h] = data[i][j]);
        return obj;
      }
    }
    return null;
  },

  findByAdmissionNo(admissionNo) {
    if (!admissionNo) return null;
    const sheet = SheetService.getSheet(SHEET_NAMES.STUDENTS);
    const data = sheet.getDataRange().getValues();
    if (data.length === 0) return null;
    
    const headers = data[0];
    const admIndex = headers.indexOf('admission_no');
    if (admIndex === -1) return null;

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][admIndex]) === String(admissionNo)) {
        const obj = {};
        headers.forEach((h, j) => obj[h] = data[i][j]);
        return obj;
      }
    }
    return null;
  },

  create(data) {
    const sheet = SheetService.getSheet(SHEET_NAMES.STUDENTS);
    const id = Utilities.getUuid();
    const now = new Date().toISOString();

    // Auto‑generate admission_no if not provided, format YYYY-####
    let admissionNo = data.admission_no;
    if (!admissionNo) {
      const year = new Date().getFullYear();
      const prefix = year + '-';
      const values = sheet.getDataRange().getValues();
      let maxSeq = 0;
      for (let i = 1; i < values.length; i++) {
        const cell = values[i][1]; // admission_no column (index 1)
        if (typeof cell === 'string' && cell.startsWith(prefix)) {
          const seqStr = cell.substring(prefix.length);
          const seq = parseInt(seqStr, 10);
          if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
        }
      }
      const nextSeq = maxSeq + 1;
      admissionNo = prefix + String(nextSeq).padStart(4, '0');
    }

    // Use explicit positional mapping matching SheetService schema:
    // ['id', 'admission_no', 'name', 'class_id', 'section_id', 'parent_phone1', 'parent_phone2', 'status', 'created_at', 'updated_at']
    const row = [
      id,
      admissionNo,
      data.name || '',
      data.class_id || '',
      data.section_id || '',
      data.parent_phone1 || '',
      data.parent_phone2 || '',
      data.status || 'pending',
      now,
      now
    ];
    
    sheet.appendRow(row);
    SpreadsheetApp.flush();
    
    const student = this.findById(id);
    
    try {
      this.autoLinkParent(student);
      this.updateClassIndex();
    } catch (e) {
      Logger.log('Post-creation tasks failed: ' + e.message);
    }
    
    return student;
  },

  update(id, data) {
    const sheet = SheetService.getSheet(SHEET_NAMES.STUDENTS);
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    const headers = values[0];
    
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][0]) === String(id)) {
        headers.forEach((h, j) => {
          if (data[h] !== undefined && h !== 'id' && h !== 'created_at') {
            values[i][j] = data[h];
          }
        });
        
        values[i][headers.indexOf('updated_at')] = new Date().toISOString();
        
        dataRange.setValues(values);
        SpreadsheetApp.flush();
        
        const student = this.findById(id);
        
        try {
          this.autoLinkParent(student);
          this.updateClassIndex();
        } catch (e) {
          Logger.log('Post-update tasks failed: ' + e.message);
        }
        
        return student;
      }
    }
    return null;
  },

  delete(id) {
    const sheet = SheetService.getSheet(SHEET_NAMES.STUDENTS);
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][0]) === String(id)) {
        sheet.deleteRow(i + 1);
        SpreadsheetApp.flush();
        
        try {
          this.updateClassIndex();
        } catch (e) {
          Logger.log('Post-delete tasks failed: ' + e.message);
        }
        return { success: true };
      }
    }
    return { success: false, error: 'Student not found' };
  },

  autoLinkParent(student) {
    if (!student.parent_phone1 && !student.parent_phone2) return;
    
    const phones = [String(student.parent_phone1), String(student.parent_phone2)].filter(p => p && p !== 'null' && p !== 'undefined' && p !== '-');
    if (phones.length === 0) return;

    const users = UserRepository.findAll().users;
    const parents = users.filter(u => u.role === 'parent' && phones.includes(String(u.phone)));
    
    parents.forEach(parent => {
      ParentStudentRepository.link(parent.id, student.id);
    });
  },

  updateClassIndex() {
    const lock = LockService.getScriptLock();
    if (lock.tryLock(10000)) {
      try {
        const students = this.findAll().students;
        const sheet = SheetService.getSheet(SHEET_NAMES.CLASS_INDEX);
        sheet.clear();
        
        sheet.appendRow(['student_id', 'class_id', 'section_id', 'admission_no', 'name']);
        
        const rows = students.map(s => [
          s.id,
          s.class_id,
          s.section_id,
          s.admission_no,
          s.name
        ]);
        
        if (rows.length > 0) {
          sheet.getRange(2, 1, rows.length, 5).setValues(rows);
        }
        
        SpreadsheetApp.flush();
      } finally {
        lock.releaseLock();
      }
    }
  },

  importFromCSV(csvData) {
    return { success: false, error: 'Import not yet implemented' };
  }
};

const ParentStudentRepository = {
  findByParentId(parentId) {
    const sheet = SheetService.getSheet(SHEET_NAMES.PARENT_STUDENTS);
    const data = sheet.getDataRange().getValues();
    if (data.length === 0) return [];
    
    const headers = data[0];
    
    return data.slice(1).filter(row => String(row[1]) === String(parentId)).map(row => {
      const obj = {};
      headers.forEach((h, j) => obj[h] = row[j]);
      return obj;
    });
  },

  findByStudentId(studentId) {
    const sheet = SheetService.getSheet(SHEET_NAMES.PARENT_STUDENTS);
    const data = sheet.getDataRange().getValues();
    if (data.length === 0) return [];
    
    const headers = data[0];
    
    return data.slice(1).filter(row => String(row[2]) === String(studentId)).map(row => {
      const obj = {};
      headers.forEach((h, j) => obj[h] = row[j]);
      return obj;
    });
  },

  link(parentId, studentId) {
    if (!parentId || !studentId) return { success: false, error: 'Parent ID and Student ID are required' };
    
    const existing = this.findByParentId(parentId).filter(p => String(p.student_id) === String(studentId));
    if (existing.length > 0) {
      return { success: false, error: 'Link already exists' };
    }
    
    const sheet = SheetService.getSheet(SHEET_NAMES.PARENT_STUDENTS);
    const id = Utilities.getUuid();
    const now = new Date().toISOString();
    
    sheet.appendRow([id, parentId, studentId, now]);
    SpreadsheetApp.flush();
    
    return { success: true, id };
  },

  unlink(parentId, studentId) {
    const sheet = SheetService.getSheet(SHEET_NAMES.PARENT_STUDENTS);
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][1]) === String(parentId) && String(values[i][2]) === String(studentId)) {
        sheet.deleteRow(i + 1);
        SpreadsheetApp.flush();
        return { success: true };
      }
    }
    return { success: false, error: 'Link not found' };
  }
};
