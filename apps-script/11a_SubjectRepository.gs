const SubjectRepository = {
  findAll(options = {}) {
    const sheet = SheetService.getSheet(SHEET_NAMES.SUBJECTS);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    let subjects = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[0]) {
        const subject = {};
        headers.forEach((header, index) => {
          subject[header] = row[index];
        });
        subjects.push(subject);
      }
    }
    
    if (options.class) {
      subjects = subjects.filter(s => String(s.class) === String(options.class));
    }
    
    if (options.teacher_id) {
      subjects = subjects.filter(s => s.teacher_id === options.teacher_id);
    }
    
    if (options.is_active !== undefined) {
      subjects = subjects.filter(s => s.is_active === options.is_active || s.is_active === 'true');
    }
    
    return subjects;
  },

  findById(id) {
    const sheet = SheetService.getSheet(SHEET_NAMES.SUBJECTS);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(id)) {
        const subject = {};
        headers.forEach((header, index) => {
          subject[header] = data[i][index];
        });
        return subject;
      }
    }
    return null;
  },

  findByCode(code) {
    const sheet = SheetService.getSheet(SHEET_NAMES.SUBJECTS);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][2]) === String(code)) {
        const subject = {};
        headers.forEach((header, index) => {
          subject[header] = data[i][index];
        });
        return subject;
      }
    }
    return null;
  },

  create(data) {
    const sheet = SheetService.getSheet(SHEET_NAMES.SUBJECTS);
    const id = Utilities.getUuid();
    const now = new Date().toISOString();
    
    const row = [
      id,
      data.name,
      data.code || '',
      data.class || '',
      data.teacher_id || '',
      data.is_active !== undefined ? data.is_active : true,
      now
    ];
    
    sheet.appendRow(row);
    return { id, ...data };
  },

  update(id, data) {
    const sheet = SheetService.getSheet(SHEET_NAMES.SUBJECTS);
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    const headers = values[0];
    
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][0]) === String(id)) {
        headers.forEach((header, index) => {
          if (data[header] !== undefined) {
            values[i][index] = data[header];
          }
        });
        sheet.getRange(i + 1, 1, 1, values[0].length).setValues([values[i]]);
        return true;
      }
    }
    return false;
  },

  delete(id) {
    const sheet = SheetService.getSheet(SHEET_NAMES.SUBJECTS);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(id)) {
        sheet.deleteRow(i + 1);
        return true;
      }
    }
    return false;
  }
};
