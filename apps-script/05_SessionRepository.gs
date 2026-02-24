const SessionRepository = {
  findByToken(token) {
    const sheet = SheetService.getSheet(SHEET_NAMES.SESSIONS);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][2] === token) {
        return data[i];
      }
    }
    return null;
  },

  findByUserId(userId) {
    const sheet = SheetService.getSheet(SHEET_NAMES.SESSIONS);
    const data = sheet.getDataRange().getValues();
    const sessions = [];
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === userId) {
        sessions.push(data[i]);
      }
    }
    return sessions;
  },

  create(sessionData) {
    const sheet = SheetService.getSheet(SHEET_NAMES.SESSIONS);
    const sessionId = Utils.generateId();
    const token = Utils.generateId();
    const now = Utils.getCurrentTimestamp();
    const timeoutMinutes = ConfigService.get('session_timeout_minutes', 5);
    const expiresAt = new Date(Date.now() + (timeoutMinutes * 60 * 1000)).toISOString();
    
    sheet.appendRow([sessionId, sessionData.userId, token, expiresAt, now]);
    
    return { sessionId, token };
  },

  updateActivity(sessionId) {
    const sheet = SheetService.getSheet(SHEET_NAMES.SESSIONS);
    const data = sheet.getDataRange().getValues();
    const now = Utils.getCurrentTimestamp();
    const timeoutMinutes = ConfigService.get('session_timeout_minutes', 5);
    const expiresAt = new Date(Date.now() + (timeoutMinutes * 60 * 1000)).toISOString();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === sessionId) {
        sheet.getRange(i + 1, 4).setValue(expiresAt);
        sheet.getRange(i + 1, 5).setValue(now);
        return true;
      }
    }
    return false;
  },

  delete(token) {
    const sheet = SheetService.getSheet(SHEET_NAMES.SESSIONS);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][2] === token) {
        sheet.deleteRow(i + 1);
        return true;
      }
    }
    return false;
  },

  isValid(token) {
    const session = this.findByToken(token);
    return session && Utils.isValidSession(session);
  }
};
