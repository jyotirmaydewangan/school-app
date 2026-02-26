const StudentRepository = {
  findAll(options = {}) {
    const sheet = SheetService.getSheet(SHEET_NAMES.STUDENTS);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const rows = data.slice(1);
    
    let students = rows.map(row => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = row[i]);
      return obj;
    }).filter(s => s.id && s.name);
    
    if (options.class) {
      students = students.filter(s => String(s.class) === String(options.class));
    }
    
    if (options.section) {
      students = students.filter(s => String(s.section) === String(options.section));
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
    const headers = data[0];
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === id) {
        const obj = {};
        headers.forEach((h, j) => obj[h] = data[i][j]);
        return obj;
      }
    }
    return null;
  },

  findByAdmissionNo(admissionNo) {
    const sheet = SheetService.getSheet(SHEET_NAMES.STUDENTS);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][2]) === String(admissionNo)) {
        const obj = {};
        headers.forEach((h, j) => obj[h] = data[i][j]);
        return obj;
      }
    }
    return null;
  },

  findByParentPhone(phone) {
    const sheet = SheetService.getSheet(SHEET_NAMES.STUDENTS);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    return data.slice(1).filter(row => {
      return String(row[5]) === String(phone) || String(row[6]) === String(phone);
    }).map(row => {
      const obj = {};
      headers.forEach((h, j) => obj[h] = row[j]);
      return obj;
    });
  },

  create(data) {
    const sheet = SheetService.getSheet(SHEET_NAMES.STUDENTS);
    const id = Utilities.getUuid();
    const now = new Date().toISOString();
    
    const row = [
      id,
      data.user_id || '',
      data.admission_no || '',
      data.name || '',
      data.class || '',
      data.section || '',
      data.parent_phone1 || '',
      data.parent_phone2 || '',
      data.status || 'pending',
      now,
      now
    ];
    
    sheet.appendRow(row);
    SpreadsheetApp.flush();
    
    this.updateClassIndex();
    
    return { id, ...data, status: data.status || 'pending', created_at: now };
  },

  update(id, data) {
    const sheet = SheetService.getSheet(SHEET_NAMES.STUDENTS);
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    const headers = values[0];
    
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === id) {
        const updateFields = ['name', 'class', 'section', 'parent_phone1', 'parent_phone2', 'status'];
        
        updateFields.forEach(field => {
          const colIndex = headers.indexOf(field);
          if (colIndex !== -1 && data[field] !== undefined) {
            values[i][colIndex] = data[field];
          }
        });
        
        values[i][headers.indexOf('updated_at')] = new Date().toISOString();
        
        dataRange.setValues(values);
        SpreadsheetApp.flush();
        
        this.updateClassIndex();
        
        return this.findById(id);
      }
    }
    return null;
  },

  delete(id) {
    const sheet = SheetService.getSheet(SHEET_NAMES.STUDENTS);
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === id) {
        sheet.deleteRow(i + 1);
        SpreadsheetApp.flush();
        
        this.updateClassIndex();
        
        return { success: true };
      }
    }
    return { success: false, error: 'Student not found' };
  },

  importFromCSV(csvData) {
    const rows = csvData.split('\n').map(row => row.split(','));
    const results = { success: 0, failed: 0, errors: [] };
    
    const headers = rows[0].map(h => h.trim().toLowerCase());
    const requiredFields = ['name', 'class'];
    
    for (let i = 1; i < rows.length; i++) {
      try {
        const row = rows[i];
        if (!row || row.length < 2 || !row[0].trim()) continue;
        
        const data = {};
        headers.forEach((h, j) => {
          data[h] = row[j] ? row[j].trim() : '';
        });
        
        const missing = requiredFields.filter(f => !data[f]);
        if (missing.length > 0) {
          results.failed++;
          results.errors.push(`Row ${i + 1}: Missing required fields: ${missing.join(', ')}`);
          continue;
        }
        
        const existing = this.findByAdmissionNo(data.admission_no);
        if (existing) {
          results.failed++;
          results.errors.push(`Row ${i + 1}: Admission number already exists`);
          continue;
        }
        
        this.create(data);
        results.success++;
      } catch (e) {
        results.failed++;
        results.errors.push(`Row ${i + 1}: ${e.message}`);
      }
    }
    
    return results;
  },

  getClasses() {
    const sheet = SheetService.getSheet(SHEET_NAMES.STUDENTS);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const classCol = headers.indexOf('class');
    
    const classes = new Set();
    for (let i = 1; i < data.length; i++) {
      if (data[i][classCol]) {
        classes.add(data[i][classCol]);
      }
    }
    
    return Array.from(classes).sort();
  },

  updateClassIndex() {
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    
    try {
      const students = this.findAll().students;
      const sheet = SheetService.getSheet(SHEET_NAMES.CLASS_INDEX);
      sheet.clear();
      
      sheet.appendRow(['student_id', 'class', 'section', 'admission_no', 'name']);
      
      const rows = students.map(s => [
        s.id,
        s.class,
        s.section,
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
  },

  getStudentsByClass(className, section = null) {
    return this.findAll({ class: className, section: section, status: 'approved' });
  }
};

const ParentStudentRepository = {
  findByParentId(parentId) {
    const sheet = SheetService.getSheet(SHEET_NAMES.PARENT_STUDENTS);
    const data = sheet.getDataRange().getValues();
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
    const headers = data[0];
    
    return data.slice(1).filter(row => String(row[2]) === String(studentId)).map(row => {
      const obj = {};
      headers.forEach((h, j) => obj[h] = row[j]);
      return obj;
    });
  },

  link(parentId, studentId) {
    const existing = this.findByParentId(parentId).filter(p => p.student_id === studentId);
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
  },

  autoLinkByPhone() {
    const students = StudentRepository.findAll({ status: 'approved' }).students;
    const parentUserIds = UserRepository.findAll().users.filter(u => u.role === 'parent').map(u => u.id);
    const linked = 0;
    
    parentUserIds.forEach(parentId => {
      const parent = UserRepository.findById(parentId);
      if (!parent || !parent.phone) return;
      
      const matchingStudents = students.filter(s => 
        String(s.parent_phone1) === String(parent.phone) || 
        String(s.parent_phone2) === String(parent.phone)
      );
      
      matchingStudents.forEach(student => {
        const result = this.link(parentId, student.id);
        if (result.success) linked++;
      });
    });
    
    return { linked };
  }
};

const SubjectRepository = {
  findAll(options = {}) {
    const sheet = SheetService.getSheet(SHEET_NAMES.SUBJECTS);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    let subjects = data.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = row[i]);
      return obj;
    }).filter(s => s.id && s.name);
    
    if (options.class) {
      subjects = subjects.filter(s => String(s.class) === String(options.class));
    }
    
    return subjects;
  },

  findById(id) {
    const sheet = SheetService.getSheet(SHEET_NAMES.SUBJECTS);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === id) {
        const obj = {};
        headers.forEach((h, j) => obj[h] = data[i][j]);
        return obj;
      }
    }
    return null;
  },

  create(data) {
    const sheet = SheetService.getSheet(SHEET_NAMES.SUBJECTS);
    const id = Utilities.getUuid();
    const now = new Date().toISOString();
    
    sheet.appendRow([id, data.name, data.class, data.teacher_id || '', now]);
    SpreadsheetApp.flush();
    
    return { id, ...data, created_at: now };
  },

  update(id, data) {
    const sheet = SheetService.getSheet(SHEET_NAMES.SUBJECTS);
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    const headers = values[0];
    
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === id) {
        ['name', 'class', 'teacher_id'].forEach(field => {
          const colIndex = headers.indexOf(field);
          if (colIndex !== -1 && data[field] !== undefined) {
            values[i][colIndex] = data[field];
          }
        });
        
        dataRange.setValues(values);
        SpreadsheetApp.flush();
        
        return this.findById(id);
      }
    }
    return null;
  },

  delete(id) {
    const sheet = SheetService.getSheet(SHEET_NAMES.SUBJECTS);
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === id) {
        sheet.deleteRow(i + 1);
        SpreadsheetApp.flush();
        return { success: true };
      }
    }
    return { success: false, error: 'Subject not found' };
  }
};
