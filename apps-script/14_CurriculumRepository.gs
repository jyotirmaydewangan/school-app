const SyllabusRepository = {
  findAll(options = {}) {
    const sheet = SheetService.getSheet(SHEET_NAMES.SYLLABUS);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    let syllabus = data.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = row[i]);
      return obj;
    }).filter(s => s.id);
    
    if (options.class) {
      syllabus = syllabus.filter(s => String(s.class) === String(options.class));
    }
    
    if (options.subject_id) {
      syllabus = syllabus.filter(s => s.subject_id === options.subject_id);
    }
    
    if (options.status) {
      syllabus = syllabus.filter(s => s.status === options.status);
    }
    
    return syllabus;
  },

  findById(id) {
    const sheet = SheetService.getSheet(SHEET_NAMES.SYLLABUS);
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
    const sheet = SheetService.getSheet(SHEET_NAMES.SYLLABUS);
    const id = Utilities.getUuid();
    const now = new Date().toISOString();
    
    const row = [
      id,
      data.class,
      data.subject_id,
      data.topic,
      data.description || '',
      data.status || 'pending',
      now
    ];
    
    sheet.appendRow(row);
    SpreadsheetApp.flush();
    
    return { id, ...data, status: data.status || 'pending', created_at: now };
  },

  update(id, data) {
    const sheet = SheetService.getSheet(SHEET_NAMES.SYLLABUS);
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    const headers = values[0];
    
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === id) {
        ['class', 'subject_id', 'topic', 'description', 'status'].forEach(field => {
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

  updateStatus(id, status) {
    return this.update(id, { status });
  },

  delete(id) {
    const sheet = SheetService.getSheet(SHEET_NAMES.SYLLABUS);
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === id) {
        sheet.deleteRow(i + 1);
        SpreadsheetApp.flush();
        return { success: true };
      }
    }
    return { success: false, error: 'Syllabus topic not found' };
  },

  getByClassAndSubject(className, subjectId) {
    return this.findAll({ class: className, subject_id: subjectId })
      .sort((a, b) => {
        const statusOrder = { pending: 1, 'in-progress': 2, completed: 3 };
        return statusOrder[a.status] - statusOrder[b.status];
      });
  },

  getProgress(className, subjectId) {
    const topics = this.findAll({ class: className, subject_id: subjectId });
    
    const total = topics.length;
    const completed = topics.filter(t => t.status === 'completed').length;
    const inProgress = topics.filter(t => t.status === 'in-progress').length;
    const pending = topics.filter(t => t.status === 'pending').length;
    
    return {
      total,
      completed,
      inProgress,
      pending,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0
    };
  }
};

const ResourceRepository = {
  findAll(options = {}) {
    const sheet = SheetService.getSheet(SHEET_NAMES.RESOURCES);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    let resources = data.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = row[i]);
      return obj;
    }).filter(r => r.id);
    
    if (options.class) {
      resources = resources.filter(r => String(r.class) === String(options.class));
    }
    
    if (options.subject_id) {
      resources = resources.filter(r => r.subject_id === options.subject_id);
    }
    
    if (options.type) {
      resources = resources.filter(r => r.type === options.type);
    }
    
    return resources;
  },

  findById(id) {
    const sheet = SheetService.getSheet(SHEET_NAMES.RESOURCES);
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
    const sheet = SheetService.getSheet(SHEET_NAMES.RESOURCES);
    const id = Utilities.getUuid();
    const now = new Date().toISOString();
    
    const row = [
      id,
      data.class,
      data.subject_id,
      data.title,
      data.type,
      data.drive_file_id || '',
      data.drive_url || '',
      now
    ];
    
    sheet.appendRow(row);
    SpreadsheetApp.flush();
    
    return { id, ...data, created_at: now };
  },

  update(id, data) {
    const sheet = SheetService.getSheet(SHEET_NAMES.RESOURCES);
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    const headers = values[0];
    
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === id) {
        ['class', 'subject_id', 'title', 'type', 'drive_file_id', 'drive_url'].forEach(field => {
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
    const sheet = SheetService.getSheet(SHEET_NAMES.RESOURCES);
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === id) {
        sheet.deleteRow(i + 1);
        SpreadsheetApp.flush();
        return { success: true };
      }
    }
    return { success: false, error: 'Resource not found' };
  },

  getByClassAndSubject(className, subjectId) {
    return this.findAll({ class: className, subject_id: subjectId })
      .map(r => {
        const subject = SubjectRepository.findById(r.subject_id);
        return {
          ...r,
          subject_name: subject ? subject.name : 'Unknown'
        };
      });
  }
};
