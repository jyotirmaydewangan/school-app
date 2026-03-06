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
    SpreadsheetApp.flush();
    const data = sheet.getDataRange().getValues();
    if (data.length === 0) return [];
    
    const headers = data[0].map(h => String(h).trim().toLowerCase());
    const parentIdColIndex = headers.indexOf('parent_id');
    
    if (parentIdColIndex === -1) {
      return [];
    }
    
    return data.slice(1).filter(row => String(row[parentIdColIndex]) === String(parentId)).map(row => {
      const obj = {};
      headers.forEach((h, j) => obj[h] = row[j]);
      return obj;
    });
  },

  findByStudentId(studentId) {
    const sheet = SheetService.getSheet(SHEET_NAMES.PARENT_STUDENTS);
    SpreadsheetApp.flush();
    const data = sheet.getDataRange().getValues();
    if (data.length === 0) return [];
    
    const headers = data[0].map(h => String(h).trim().toLowerCase());
    const studentIdColIndex = headers.indexOf('student_id');
    const parentIdColIndex = headers.indexOf('parent_id');
    
    if (studentIdColIndex === -1 || parentIdColIndex === -1) {
      return [];
    }
    
    return data.slice(1).filter(row => String(row[studentIdColIndex]) === String(studentId)).map(row => {
      const obj = {};
      headers.forEach((h, j) => obj[h] = row[j]);
      return obj;
    });
  },

  link(parentId, studentId) {
    if (!parentId || !studentId) return { success: false, error: 'Parent ID and Student ID are required' };
    
    // Check for existing link directly
    const sheet = SheetService.getSheet(SHEET_NAMES.PARENT_STUDENTS);
    SpreadsheetApp.flush();
    const data = sheet.getDataRange().getValues();
    
    if (data.length > 0) {
      const headers = data[0].map(h => String(h).trim().toLowerCase());
      const parentIdColIndex = headers.indexOf('parent_id');
      const studentIdColIndex = headers.indexOf('student_id');
      
      const pId = String(parentId).trim();
      const sId = String(studentId).trim();

      if (parentIdColIndex !== -1 && studentIdColIndex !== -1) {
        for (let i = 1; i < data.length; i++) {
          if (String(data[i][parentIdColIndex]).trim() === pId && 
              String(data[i][studentIdColIndex]).trim() === sId) {
            return { success: false, error: 'Link already exists' };
          }
        }
      }
    }
    
    const id = Utilities.getUuid();
    const now = new Date().toISOString();
    
    sheet.appendRow([id, parentId, studentId, now]);
    SpreadsheetApp.flush();
    
    return { success: true, id };
  },

  unlink(parentId, studentId) {
    const sheet = SheetService.getSheet(SHEET_NAMES.PARENT_STUDENTS);
    SpreadsheetApp.flush();
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    
    const headers = values[0].map(h => String(h).trim().toLowerCase());
    const parentIdColIndex = headers.indexOf('parent_id');
    const studentIdColIndex = headers.indexOf('student_id');
    
    if (parentIdColIndex === -1 || studentIdColIndex === -1) {
      return { success: false, error: 'Invalid sheet structure' };
    }
    
    const pId = String(parentId).trim();
    const sId = String(studentId).trim();

    for (let i = 1; i < values.length; i++) {
      if (String(values[i][parentIdColIndex]).trim() === pId && String(values[i][studentIdColIndex]).trim() === sId) {
        sheet.deleteRow(i + 1);
        SpreadsheetApp.flush();
        return { success: true };
      }
    }
    return { success: false, error: 'Link not found' };
  },

  autoLinkByPhone() {
    const sheet = SheetService.getSheet(SHEET_NAMES.PARENT_STUDENTS);
    const data = sheet.getDataRange().getValues();
    const headers = data[0] ? data[0].map(h => String(h).trim().toLowerCase()) : [];
    
    let parentIdColIndex = headers.indexOf('parent_id');
    let studentIdColIndex = headers.indexOf('student_id');
    
    // Safety check - should have headers
    if (parentIdColIndex === -1 || studentIdColIndex === -1) {
       return { success: false, error: 'Database not initialized properly' };
    }

    // 1. Build a set of existing links for fast O(1) lookups
    const existingLinks = new Set();
    for (let i = 1; i < data.length; i++) {
        const pId = String(data[i][parentIdColIndex]).trim();
        const sId = String(data[i][studentIdColIndex]).trim();
        existingLinks.add(`${pId}_${sId}`);
    }

    // 2. Fetch Users and Students
    const users = UserRepository.findAll().users;
    const parents = users.filter(u => u.role === 'parent' && u.phone);
    const students = StudentRepository.findAll().students;
    
    // 3. Build a map of phones to parents for O(1) lookups
    const phoneToParents = {};
    parents.forEach(p => {
        const phone = String(p.phone).trim();
        if (!phoneToParents[phone]) phoneToParents[phone] = [];
        phoneToParents[phone].push(p);
    });

    let linkedCount = 0;
    let existingCount = 0;
    const newRows = [];
    const now = new Date().toISOString();

    // 4. Iterate over students and match with parents
    students.forEach(student => {
      const studentId = String(student.id).trim();
      const phones = [String(student.parent_phone1), String(student.parent_phone2)]
            .map(p => p.trim())
            .filter(p => p && p !== 'null' && p !== 'undefined' && p !== '-');
      
      if (phones.length === 0) return;
      
      // Match phones
      phones.forEach(phone => {
        if (phoneToParents[phone]) {
            phoneToParents[phone].forEach(parent => {
                const parentId = String(parent.id).trim();
                const linkKey = `${parentId}_${studentId}`;
                
                if (existingLinks.has(linkKey)) {
                    existingCount++;
                } else {
                    const id = Utilities.getUuid();
                    newRows.push([id, parentId, studentId, now]);
                    existingLinks.add(linkKey); // Prevent duplicate adds in this run
                    linkedCount++;
                }
            });
        }
      });
    });
    
    // 5. Batch write the new rows if any exist
    if (newRows.length > 0) {
        const startRow = sheet.getLastRow() + 1;
        const numRows = newRows.length;
        const numCols = newRows[0].length;
        sheet.getRange(startRow, 1, numRows, numCols).setValues(newRows);
        SpreadsheetApp.flush();
    }
    
    return { success: true, linked: linkedCount, existing: existingCount };
  }
};
