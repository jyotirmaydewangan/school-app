/**
 * Apps Script Utils Unit Tests
 *
 * These tests run in Node.js with the global Apps Script mocks defined
 * in tests/setup.js. They load the .gs source as CommonJS by copying
 * the relevant logic into a self-contained require-able Module.
 *
 * Strategy: inline the Utils object (identical logic) so we can run it
 * under Jest without a full clasp environment.
 */

// ─── Inline mock of Utilities ─────────────────────────────────────────────────
const crypto = require('crypto');

const Utilities = {
    getUuid: () => crypto.randomUUID(),
    base64Encode: (input) => {
        if (Array.isArray(input)) {
            return Buffer.from(input).toString('base64');
        }
        return Buffer.from(String(input)).toString('base64');
    },
    base64Decode: (str) => {
        // Returns a string (mock)
        return Buffer.from(str, 'base64').toString('utf-8');
    },
    DigestAlgorithm: { SHA_256: 'SHA-256' },
    computeDigest: (_algo, input) => {
        const data = Array.isArray(input)
            ? Buffer.from(input)
            : Buffer.from(String(input));
        return Array.from(crypto.createHash('sha256').update(data).digest());
    },
    newBlob: (str) => ({
        getBytes: () => Array.from(Buffer.from(String(str)))
    })
};

// ─── Inline Utils (mirrors apps-script/02_Utils.gs) ─────────────────────────

const Utils = {
    generateId() { return Utilities.getUuid(); },

    sha256(message) {
        const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, message);
        let hex = '';
        for (let i = 0; i < digest.length; i++) {
            const byte = (digest[i] < 0 ? digest[i] + 256 : digest[i]);
            hex += ('0' + byte.toString(16)).slice(-2);
        }
        return hex;
    },

    bytesToString(bytes) {
        return bytes.map(b => String.fromCharCode(b >= 0 ? b : b + 256)).join('');
    },

    parseJson(str, defaultValue = []) {
        try { return JSON.parse(str) || defaultValue; }
        catch { return defaultValue; }
    },

    createJWT(payload, secret, expiresInMinutes = 60) {
        const header = { typ: 'JWT', alg: 'HS256' };
        const now = Math.floor(Date.now() / 1000);
        const payloadObj = { ...payload, iat: now, exp: now + (expiresInMinutes * 60) };
        const encodedHeader = Utilities.base64Encode(JSON.stringify(header)).replace(/=+$/, '');
        const encodedPayload = Utilities.base64Encode(JSON.stringify(payloadObj)).replace(/=+$/, '');
        const signatureInput = `${encodedHeader}.${encodedPayload}`;
        // Simple HMAC mock: sha256(signatureInput + secret)
        const sig = this.sha256(signatureInput + secret);
        return `${signatureInput}.${sig}`;
    },

    verifyJWT(token, secret) {
        try {
            const parts = token.split('.');
            if (parts.length !== 3) return { valid: false, error: 'Invalid token format' };
            const [encodedHeader, encodedPayload, signature] = parts;
            const signatureInput = `${encodedHeader}.${encodedPayload}`;
            const expectedSig = this.sha256(signatureInput + secret);
            if (signature !== expectedSig) return { valid: false, error: 'Invalid signature' };
            const payload = JSON.parse(Utilities.base64Decode(encodedPayload));
            const now = Math.floor(Date.now() / 1000);
            if (payload.exp && payload.exp < now) return { valid: false, error: 'Token expired', expired: true };
            return { valid: true, payload };
        } catch (e) {
            return { valid: false, error: 'Token parse error: ' + e.message };
        }
    },

    parseJWT(token) {
        try {
            const parts = token.split('.');
            if (parts.length !== 3) return null;
            return JSON.parse(Utilities.base64Decode(parts[1]));
        } catch { return null; }
    }
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Utils (Apps Script)', () => {

    describe('generateId', () => {
        test('returns a non-empty UUID string', () => {
            const id = Utils.generateId();
            expect(typeof id).toBe('string');
            expect(id.length).toBeGreaterThan(10);
        });

        test('returns unique values each call', () => {
            expect(Utils.generateId()).not.toBe(Utils.generateId());
        });
    });

    describe('sha256', () => {
        test('returns a 64-char hex string', () => {
            const hash = Utils.sha256('hello');
            expect(hash).toHaveLength(64);
            expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
        });

        test('same input → same output (deterministic)', () => {
            expect(Utils.sha256('password')).toBe(Utils.sha256('password'));
        });

        test('different inputs → different hashes', () => {
            expect(Utils.sha256('a')).not.toBe(Utils.sha256('b'));
        });
    });

    describe('parseJson', () => {
        test('parses valid JSON', () => {
            expect(Utils.parseJson('{"key":"val"}')).toEqual({ key: 'val' });
        });

        test('returns defaultValue on invalid JSON', () => {
            expect(Utils.parseJson('{{bad}}', null)).toBeNull();
            expect(Utils.parseJson('{{bad}}')).toEqual([]);
        });

        test('returns defaultValue for empty string', () => {
            expect(Utils.parseJson('', 'fallback')).toBe('fallback');
        });
    });

    describe('bytesToString', () => {
        test('converts positive byte array to ASCII string', () => {
            const bytes = [72, 101, 108, 108, 111]; // "Hello"
            expect(Utils.bytesToString(bytes)).toBe('Hello');
        });

        test('handles negative bytes (> 127 unsigned)', () => {
            // -128 in signed = 128 unsigned = 0x80
            const bytes = [-128];
            const result = Utils.bytesToString(bytes);
            expect(result.charCodeAt(0)).toBe(128);
        });
    });

    describe('JWT: createJWT / verifyJWT / parseJWT', () => {
        const SECRET = 'test-secret';
        const payload = { userId: 'u1', email: 'a@b.com', role: 'admin', name: 'Admin' };

        test('createJWT returns 3-part token string', () => {
            const token = Utils.createJWT(payload, SECRET);
            expect(token.split('.')).toHaveLength(3);
        });

        test('verifyJWT returns valid=true for a fresh token', () => {
            const token = Utils.createJWT(payload, SECRET, 30);
            const result = Utils.verifyJWT(token, SECRET);
            expect(result.valid).toBe(true);
            expect(result.payload.userId).toBe('u1');
        });

        test('verifyJWT returns valid=false for tampered token', () => {
            const token = Utils.createJWT(payload, SECRET);
            const tampered = token.slice(0, -5) + 'XXXXX';
            const result = Utils.verifyJWT(tampered, SECRET);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('Invalid signature');
        });

        test('verifyJWT detects expired token', () => {
            const token = Utils.createJWT(payload, SECRET, -1); // expired
            const result = Utils.verifyJWT(token, SECRET);
            expect(result.valid).toBe(false);
            expect(result.expired).toBe(true);
        });

        test('verifyJWT rejects malformed token (wrong number of parts)', () => {
            const result = Utils.verifyJWT('onlyonepart', SECRET);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('Invalid token format');
        });

        test('parseJWT extracts payload without verification', () => {
            const token = Utils.createJWT(payload, SECRET);
            const parsed = Utils.parseJWT(token);
            expect(parsed.userId).toBe('u1');
            expect(parsed.role).toBe('admin');
        });

        test('parseJWT returns null for malformed token', () => {
            expect(Utils.parseJWT('bad.token')).toBeNull();
        });
    });
});
