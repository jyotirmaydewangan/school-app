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

  create(data) {
    const sheet = SheetService.getSheet(SHEET_NAMES.STUDENTS);
    const id = Utilities.getUuid();
    const now = new Date().toISOString();
    
    const row = [
      id,
      data.user_id || '',
      data.admission_no || '',
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
    
    const student = { id, ...data, status: data.status || 'pending', created_at: now };
    this.autoLinkParent(student);
    this.updateClassIndex();
    
    return student;
  },

  update(id, data) {
    const sheet = SheetService.getSheet(SHEET_NAMES.STUDENTS);
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    const headers = values[0];
    
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === id) {
        const updateFields = ['name', 'class_id', 'section_id', 'parent_phone1', 'parent_phone2', 'status'];
        
        updateFields.forEach(field => {
          const colIndex = headers.indexOf(field);
          if (colIndex !== -1 && data[field] !== undefined) {
            values[i][colIndex] = data[field];
          }
        });
        
        values[i][headers.indexOf('updated_at')] = new Date().toISOString();
        
        dataRange.setValues(values);
        SpreadsheetApp.flush();
        
        const student = this.findById(id);
        this.autoLinkParent(student);
        this.updateClassIndex();
        
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
      if (values[i][0] === id) {
        sheet.deleteRow(i + 1);
        SpreadsheetApp.flush();
        
        this.updateClassIndex();
        return { success: true };
      }
    }
    return { success: false, error: 'Student not found' };
  },

  autoLinkParent(student) {
    if (!student.parent_phone1 && !student.parent_phone2) return;
    
    const phones = [student.parent_phone1, student.parent_phone2].filter(p => p);
    const parents = UserRepository.findAll().users.filter(u => u.role === 'parent' && phones.includes(String(u.phone)));
    
    parents.forEach(parent => {
      ParentStudentRepository.link(parent.id, student.id);
    });
  },

  updateClassIndex() {
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    
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
