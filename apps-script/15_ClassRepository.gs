const ClassRepository = {
  findAll(options = {}) {
    const sheet = SheetService.getSheet(SHEET_NAMES.CLASSES);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const allClasses = [];
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0]) {
        allClasses.push(this.mapRowToClass(headers, data[i]));
      }
    }
    
    let filtered = allClasses;
    
    if (options.is_active !== undefined) {
      filtered = filtered.filter(c => c.is_active === options.is_active);
    }
    
    if (options.academic_year) {
      filtered = filtered.filter(c => c.academic_year === options.academic_year);
    }
    
    const total = filtered.length;
    
    if (options.limit && options.limit > 0) {
      const offset = options.offset || 0;
      filtered = filtered.slice(offset, offset + options.limit);
    }
    
    return {
      classes: filtered,
      total: total
    };
  },

  findById(id) {
    const sheet = SheetService.getSheet(SHEET_NAMES.CLASSES);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === id) {
        return this.mapRowToClass(headers, data[i]);
      }
    }
    return null;
  },

  findByNameAndSection(name, section) {
    const sheet = SheetService.getSheet(SHEET_NAMES.CLASSES);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === name && data[i][2] === section) {
        return this.mapRowToClass(headers, data[i]);
      }
    }
    return null;
  },

  create(classData) {
    const sheet = SheetService.getSheet(SHEET_NAMES.CLASSES);
    const id = Utils.generateId();
    const now = Utils.getCurrentTimestamp();
    
    const existing = this.findByNameAndSection(classData.name, classData.section);
    if (existing) {
      return { success: false, error: 'Class with this name and section already exists' };
    }
    
    sheet.appendRow([
      id,
      classData.name || '',
      classData.section || '',
      classData.stream || '',
      classData.academic_year || new Date().getFullYear().toString(),
      classData.is_active !== false,
      now
    ]);
    
    return this.findById(id);
  },

  update(id, classData) {
    const sheet = SheetService.getSheet(SHEET_NAMES.CLASSES);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === id) {
        const row = i + 1;
        if (classData.name !== undefined) sheet.getRange(row, 2).setValue(classData.name);
        if (classData.section !== undefined) sheet.getRange(row, 3).setValue(classData.section);
        if (classData.stream !== undefined) sheet.getRange(row, 4).setValue(classData.stream);
        if (classData.academic_year !== undefined) sheet.getRange(row, 5).setValue(classData.academic_year);
        if (classData.is_active !== undefined) sheet.getRange(row, 6).setValue(classData.is_active);
        return this.findById(id);
      }
    }
    return null;
  },

  delete(id) {
    const sheet = SheetService.getSheet(SHEET_NAMES.CLASSES);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === id) {
        sheet.deleteRow(i + 1);
        return true;
      }
    }
    return false;
  },

  getSections(className) {
    const result = this.findAll({});
    const sections = result.classes
      .filter(c => c.name === className && c.is_active)
      .map(c => c.section)
      .filter(s => s);
    return [...new Set(sections)];
  },

  getAcademicYears() {
    const result = this.findAll({});
    const years = result.classes.map(c => c.academic_year).filter(y => y);
    return [...new Set(years)].sort().reverse();
  },

  mapRowToClass(headers, row) {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index];
    });
    return obj;
  }
};
