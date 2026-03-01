const SchoolRepository = {
  findAll(options = {}) {
    const sheet = SheetService.getSheet(SHEET_NAMES.SCHOOLS);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const rows = data.slice(1);
    
    Logger.log('School sheet headers: ' + JSON.stringify(headers));
    Logger.log('School sheet rows count: ' + rows.length);
    
    let schools = rows.map(row => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = row[i]);
      return obj;
    }).filter(s => s.id);
    
    Logger.log('Filtered schools (id only): ' + JSON.stringify(schools));
    
    return { schools, total: schools.length };
  },

  findById(id) {
    const sheet = SheetService.getSheet(SHEET_NAMES.SCHOOLS);
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
    const sheet = SheetService.getSheet(SHEET_NAMES.SCHOOLS);
    const id = Utilities.getUuid();
    const now = new Date().toISOString();
    
    const row = [
      id,
      data.name || '',
      data.code || '',
      data.address || '',
      data.contact || '',
      now
    ];
    
    sheet.appendRow(row);
    SpreadsheetApp.flush();
    
    return { id, ...data, created_at: now };
  },

  update(id, data) {
    const sheet = SheetService.getSheet(SHEET_NAMES.SCHOOLS);
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    const headers = values[0];
    
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === id) {
        ['name', 'code', 'address', 'contact'].forEach(field => {
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
    const sheet = SheetService.getSheet(SHEET_NAMES.SCHOOLS);
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === id) {
        sheet.deleteRow(i + 1);
        SpreadsheetApp.flush();
        return { success: true };
      }
    }
    return { success: false, error: 'School not found' };
  }
};
