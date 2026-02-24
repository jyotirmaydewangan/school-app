const ConfigService = {
  get(key, defaultValue = null) {
    const sheet = SheetService.getSheet(SHEET_NAMES.CONFIG);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === key) {
        return data[i][1] || defaultValue;
      }
    }
    return defaultValue;
  },

  set(key, value) {
    const sheet = SheetService.getSheet(SHEET_NAMES.CONFIG);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === key) {
        sheet.getRange(i + 1, 2).setValue(value);
        return true;
      }
    }
    
    sheet.appendRow([key, value]);
    return true;
  },

  getAll() {
    const sheet = SheetService.getSheet(SHEET_NAMES.CONFIG);
    const data = sheet.getDataRange().getValues();
    const config = {};
    
    for (let i = 1; i < data.length; i++) {
      config[data[i][0]] = data[i][1];
    }
    
    return config;
  }
};
