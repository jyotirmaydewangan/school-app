const ConfigService = {
  get(key, defaultValue = null) {
    try {
      if (typeof TENANT_CONFIG !== 'undefined' && TENANT_CONFIG !== null) {
        if (key === 'jwt_secret' && TENANT_CONFIG.JWT_SECRET) {
          return TENANT_CONFIG.JWT_SECRET;
        }
        if (key === 'session_timeout_minutes' && TENANT_CONFIG.SESSION_TIMEOUT_MINUTES) {
          return TENANT_CONFIG.SESSION_TIMEOUT_MINUTES;
        }
        if (TENANT_CONFIG[key] !== undefined) {
          return TENANT_CONFIG[key];
        }
      }
    } catch (e) {
      // TENANT_CONFIG not available
    }
    
    try {
      const sheet = SheetService.getSheet(SHEET_NAMES.CONFIG);
      const data = sheet.getDataRange().getValues();
      
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === key) {
          return data[i][1] || defaultValue;
        }
      }
    } catch (e) {
      // Sheet not available
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
