const ClassRepository = {
  findAll(options = {}) {
    const sheet = SheetService.getSheet(SHEET_NAMES.CLASSES);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const rows = data.slice(1);
    
    let classes = rows.map(row => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = row[i]);
      return obj;
    }).filter(c => c.id && c.name);
    
    if (options.school_id) {
      classes = classes.filter(c => String(c.school_id) === String(options.school_id));
    }

    if (options.is_active !== undefined) {
      classes = classes.filter(c => c.is_active === options.is_active);
    }
    
    if (options.academic_year) {
      classes = classes.filter(c => c.academic_year === options.academic_year);
    }
    
    const total = classes.length;
    
    if (options.limit && options.limit > 0) {
      const offset = options.offset || 0;
      classes = classes.slice(offset, offset + options.limit);
    }
    
    return {
      classes,
      total
    };
  },

  findById(id) {
    const sheet = SheetService.getSheet(SHEET_NAMES.CLASSES);
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

  create(classData) {
    const sheet = SheetService.getSheet(SHEET_NAMES.CLASSES);
    const id = Utilities.getUuid();
    const now = new Date().toISOString();
    
    sheet.appendRow([
      id,
      classData.school_id || '',
      classData.name || '',
      classData.stream || '',
      classData.academic_year || new Date().getFullYear().toString(),
      classData.is_active !== false,
      now
    ]);
    SpreadsheetApp.flush();
    
    return this.findById(id);
  },

  update(id, classData) {
    const sheet = SheetService.getSheet(SHEET_NAMES.CLASSES);
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    const headers = values[0];
    
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === id) {
        ['school_id', 'name', 'stream', 'academic_year', 'is_active'].forEach(field => {
          const colIndex = headers.indexOf(field);
          if (colIndex !== -1 && classData[field] !== undefined) {
            values[i][colIndex] = classData[field];
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
    const sheet = SheetService.getSheet(SHEET_NAMES.CLASSES);
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === id) {
        sheet.deleteRow(i + 1);
        SpreadsheetApp.flush();
        return true;
      }
    }
    return false;
  }
};
