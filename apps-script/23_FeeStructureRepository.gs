const FeeStructureRepository = {
  findAll(options = {}) {
    const sheet = SheetService.getSheet(SHEET_NAMES.FEE_STRUCTURES);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const structures = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const structure = {};
      headers.forEach((header, index) => {
        structure[header] = row[index];
      });
      structures.push(structure);
    }
    
    if (options.class) {
      return structures.filter(s => s.class === options.class);
    }
    
    if (options.academic_year) {
      return structures.filter(s => s.academic_year === options.academic_year);
    }
    
    if (options.fee_type) {
      return structures.filter(s => s.fee_type === options.fee_type);
    }
    
    if (options.is_active !== undefined) {
      return structures.filter(s => String(s.is_active) === String(options.is_active));
    }
    
    return structures;
  },

  findById(id) {
    const sheet = SheetService.getSheet(SHEET_NAMES.FEE_STRUCTURES);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(id)) {
        const structure = {};
        headers.forEach((header, index) => {
          structure[header] = data[i][index];
        });
        return structure;
      }
    }
    return null;
  },

  findByClassAndYear(className, academicYear) {
    const sheet = SheetService.getSheet(SHEET_NAMES.FEE_STRUCTURES);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const structures = [];
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][3]) === String(className) && 
          String(data[i][4]) === String(academicYear) &&
          (String(data[i][6]).toLowerCase() === 'true' || String(data[i][6]) === '1')) {
        const structure = {};
        headers.forEach((header, index) => {
          structure[header] = data[i][index];
        });
        structures.push(structure);
      }
    }
    return structures;
  },

  create(data) {
    const sheet = SheetService.getSheet(SHEET_NAMES.FEE_STRUCTURES);
    const id = Utilities.getUuid();
    const now = new Date().toISOString();
    
    const row = [
      id,
      data.name,
      data.fee_type || 'General',
      data.class || 'All',
      data.academic_year || new Date().getFullYear().toString(),
      data.amount,
      data.is_active !== false,
      now,
      data.created_by || ''
    ];
    
    sheet.appendRow(row);
    return { id, ...data };
  },

  update(id, data) {
    const sheet = SheetService.getSheet(SHEET_NAMES.FEE_STRUCTURES);
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
    const sheet = SheetService.getSheet(SHEET_NAMES.FEE_STRUCTURES);
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
