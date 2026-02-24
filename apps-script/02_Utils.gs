const Utils = {
  generateId() {
    return Utilities.getUuid();
  },

  sha256(message) {
    const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, message);
    let hex = '';
    for (let i = 0; i < digest.length; i++) {
      const byte = (digest[i] < 0 ? digest[i] + 256 : digest[i]);
      hex += ('0' + byte.toString(16)).slice(-2);
    }
    return hex;
  },

  getCurrentTimestamp() {
    return new Date().toISOString();
  },

  parseJson(str, defaultValue = []) {
    try {
      return JSON.parse(str) || defaultValue;
    } catch {
      return defaultValue;
    }
  },

  isValidSession(session) {
    if (!session) return false;
    
    const timeoutMinutes = ConfigService.get('session_timeout_minutes', 5);
    const expiresAt = new Date(session[3]);
    const lastActivity = new Date(session[4]);
    const now = new Date();
    
    return now < expiresAt && now < lastActivity.getTime() + (timeoutMinutes * 60 * 1000);
  }
};
