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

  hashPassword(password) {
    const salt = Utilities.getUuid();
    const hash = this.sha256(password + salt);
    return salt + ':' + hash;
  },

  verifyPassword(password, storedHash) {
    if (!storedHash || !storedHash.includes(':')) return false;
    const parts = storedHash.split(':');
    const salt = parts[0];
    const expectedHash = parts[1];
    const hash = this.sha256(password + salt);
    return hash === expectedHash;
  },

  bytesToString(bytes) {
    return bytes.map(b => String.fromCharCode(b >= 0 ? b : b + 256)).join('');
  },

  hmacSha256(message, key) {
    if (key === null || key === undefined) key = '';
    if (message === null || message === undefined) message = '';
    
    // Ensure inputs are strings or byte arrays as expected by newBlob
    const keyBlob = Utilities.newBlob(key);
    const keyBytes = keyBlob.getBytes();
    const blockSize = 64;
    let keyBlock = keyBytes.slice(0, blockSize);
    
    if (keyBytes.length > blockSize) {
      const keyHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, keyBytes);
      keyBlock = [];
      for (let i = 0; i < blockSize; i++) {
        keyBlock.push(keyHash[i] || 0);
      }
    }
    
    const oKeyPad = [];
    const iKeyPad = [];
    for (let i = 0; i < blockSize; i++) {
      const kb = keyBlock[i] || 0;
      oKeyPad.push(0x5c ^ kb);
      iKeyPad.push(0x36 ^ kb);
    }
    
    const msgBlob = Utilities.newBlob(message);
    const msgBytes = msgBlob.getBytes();
    
    const inner = [];
    for (let i = 0; i < iKeyPad.length; i++) inner.push(iKeyPad[i]);
    for (let i = 0; i < msgBytes.length; i++) inner.push(msgBytes[i]);
    const innerHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, inner);
    
    const outer = [];
    for (let i = 0; i < oKeyPad.length; i++) outer.push(oKeyPad[i]);
    for (let i = 0; i < innerHash.length; i++) outer.push(innerHash[i]);
    return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, outer);
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
    
    const secret = ConfigService.get('jwt_secret', 'missing-secret-key-please-change');
    const signatureBytes = Utils.hmacSha256(signatureInput, secret);
    const signature = Utilities.base64Encode(signatureBytes).replace(/=+$/, '');
    
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
      
      let secret = ConfigService.get('jwt_secret');
      const signatureBytes = Utils.hmacSha256(signatureInput, secret);
      const expectedSignature = Utilities.base64Encode(signatureBytes).replace(/=+$/, '');

      if (signature !== expectedSignature) {
        return { valid: false, error: 'Invalid signature' };
      }

      const payloadBytes = Utilities.base64Decode(encodedPayload);
      const payload = JSON.parse(Utils.bytesToString(payloadBytes));
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
      const payloadBytes = Utilities.base64Decode(parts[1]);
      const payload = JSON.parse(Utils.bytesToString(payloadBytes));
      return payload;
    } catch {
      return null;
    }
  }
};
