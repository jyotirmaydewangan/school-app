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
    
    const timeoutMinutes = ConfigService.get('session_timeout_minutes', 60);
    const expiresAt = new Date(session[3]);
    const lastActivity = new Date(session[4]);
    const now = new Date();
    
    return now < expiresAt && now < lastActivity.getTime() + (timeoutMinutes * 60 * 1000);
  },

  createJWT(payload, expiresInMinutes = 60) {
    const header = { typ: 'JWT', alg: 'HS256' };
    const now = Math.floor(Date.now() / 1000);
    const payloadObj = {
      ...payload,
      iat: now,
      exp: now + (expiresInMinutes * 60)
    };
    
    const encodedHeader = Utilities.base64Encode(JSON.stringify(header)).replace(/=+$/, '');
    const encodedPayload = Utilities.base64Encode(JSON.stringify(payloadObj)).replace(/=+$/, '');
    const signatureInput = encodedHeader + '.' + encodedPayload;
    
    const secret = ConfigService.get('jwt_secret', 'default_jwt_secret_change_me');
    const signature = Utilities.base64Encode(
      Utilities.computeHmacSha256(signatureInput, secret)
    ).replace(/=+$/, '');
    
    return signatureInput + '.' + signature;
  },

  verifyJWT(token) {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return { valid: false, error: 'Invalid token format' };
      }

      const [encodedHeader, encodedPayload, signature] = parts;
      const signatureInput = encodedHeader + '.' + encodedPayload;
      
      const secret = ConfigService.get('jwt_secret', 'default_jwt_secret_change_me');
      const expectedSignature = Utilities.base64Encode(
        Utilities.computeHmacSha256(signatureInput, secret)
      ).replace(/=+$/, '');

      if (signature !== expectedSignature) {
        return { valid: false, error: 'Invalid signature' };
      }

      const payload = JSON.parse(Utilities.base64Decode(encodedPayload));
      const now = Math.floor(Date.now() / 1000);

      if (payload.exp && payload.exp < now) {
        return { valid: false, error: 'Token expired', expired: true };
      }

      return { valid: true, payload };
    } catch (e) {
      return { valid: false, error: 'Token parse error: ' + e.message };
    }
  },

  parseJWT(token) {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const payload = JSON.parse(Utilities.base64Decode(parts[1]));
      return payload;
    } catch {
      return null;
    }
  }
};
