/**
 * AuthHandler Business Logic Tests
 * Tests the core auth flows: register, login, logout, verify, isAdmin.
 * Uses inline mocks for UserRepository, SessionRepository, Utils, ConfigService.
 */

// ─── Inline Mocks ─────────────────────────────────────────────────────────────

const crypto = require('crypto');

// Simple deterministic SHA-256 mock
const sha256 = (msg) => {
    return crypto.createHash('sha256').update(String(msg)).digest('hex');
};

// Minimal JWT helpers (mirrors the real Utils)
const createJWT = (payload, secret = 'test-secret', expiresInMin = 60) => {
    const header = Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'HS256' })).toString('base64').replace(/=+$/, '');
    const now = Math.floor(Date.now() / 1000);
    const fullPayload = { ...payload, iat: now, exp: now + expiresInMin * 60 };
    const enc = Buffer.from(JSON.stringify(fullPayload)).toString('base64').replace(/=+$/, '');
    const sig = sha256(`${header}.${enc}` + secret);
    return `${header}.${enc}.${sig}`;
};

const verifyJWT = (token, secret = 'test-secret') => {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return { valid: false, error: 'Invalid token format' };
        const [h, p, sig] = parts;
        const expected = sha256(`${h}.${p}` + secret);
        if (sig !== expected) return { valid: false, error: 'Invalid signature' };
        const payload = JSON.parse(Buffer.from(p, 'base64').toString('utf8'));
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp < now) return { valid: false, error: 'Token expired', expired: true };
        return { valid: true, payload };
    } catch (e) {
        return { valid: false, error: 'Token parse error' };
    }
};

// In-memory user store
let _userStore = {};

const UserRepository = {
    reset() { _userStore = {}; },
    findByEmail(email) { return _userStore[email] || null; },
    create(data) {
        const user = { id: 'uid-' + Date.now(), is_approved: false, ...data };
        _userStore[data.email] = user;
        return user;
    }
};

const SessionRepository = {
    _sessions: {},
    delete(token) {
        if (this._sessions[token]) { delete this._sessions[token]; return true; }
        return false;
    }
};

const ConfigService = { get: (key, def) => def };

// ─── Inline AuthHandler (mirrors apps-script/07_AuthHandler.gs) ──────────────

const AuthHandler = {
    register(data) {
        if (!data.email || !data.password || !data.name)
            return { success: false, error: 'Email, password, and name are required' };

        const existing = UserRepository.findByEmail(data.email);
        if (existing) {
            if (existing.rejected_at) return { success: false, error: 'Your previous registration was rejected. Please contact administrator.' };
            if (!existing.is_approved) return { success: false, error: 'Registration pending approval. Please wait for admin to approve.' };
            return { success: false, error: 'Email already registered' };
        }

        const roles = ['admin', 'teacher', 'parent', 'student'];
        const role = data.role && roles.includes(data.role) ? data.role : 'parent';
        const user = UserRepository.create({ email: data.email, name: data.name, role, password_hash: sha256(data.password) });
        const pendingApproval = role !== 'admin' && role !== 'student';
        return { success: true, pending_approval: pendingApproval, user: { id: user.id, email: user.email, role } };
    },

    login(data) {
        if (!data.email || !data.password) return { success: false, error: 'Email and password are required' };
        const user = UserRepository.findByEmail(data.email);
        if (!user) return { success: false, error: 'Invalid credentials' };
        if (!user.is_approved) {
            if (user.rejected_at) return { success: false, error: 'Your registration has been rejected. Please contact administrator.' };
            return { success: false, error: 'Your registration is pending approval. Please wait for admin to approve.' };
        }
        if (user.password_hash !== sha256(data.password)) return { success: false, error: 'Invalid credentials' };
        const token = createJWT({ userId: user.id, email: user.email, role: user.role, name: user.name }, 'test-secret', 60);
        return { success: true, token, user: { id: user.id, email: user.email, role: user.role } };
    },

    logout(token) {
        if (!token) return { success: false, error: 'Token is required' };
        const deleted = SessionRepository.delete(token);
        return deleted ? { success: true, message: 'Logged out successfully' }
            : { success: false, error: 'Session not found' };
    },

    verify(token) {
        if (!token) return { success: false, error: 'Token is required', valid: false };
        const result = verifyJWT(token, 'test-secret');
        if (!result.valid) return { success: false, error: result.error, valid: false, expired: result.expired || false };
        const p = result.payload;
        return { success: true, valid: true, user: { id: p.userId, email: p.email, name: p.name, role: p.role } };
    },

    isAdmin(token) {
        if (!token) return false;
        const r = verifyJWT(token, 'test-secret');
        return r.valid && r.payload.role === 'admin';
    }
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AuthHandler (Apps Script)', () => {
    beforeEach(() => {
        UserRepository.reset();
        SessionRepository._sessions = {};
    });

    // ─── register ─────────────────────────────────────────────────────────────

    describe('register', () => {
        test('requires email, password, and name', () => {
            expect(AuthHandler.register({}).success).toBe(false);
            expect(AuthHandler.register({ email: 'a@b.com' }).success).toBe(false);
            expect(AuthHandler.register({ email: 'a@b.com', password: 'x' }).success).toBe(false);
        });

        test('creates a new user and returns pending_approval=true for non-admin roles', () => {
            const r = AuthHandler.register({ email: 'teacher@school.com', password: 'pass', name: 'Mr. T', role: 'teacher' });
            expect(r.success).toBe(true);
            expect(r.pending_approval).toBe(true);
            expect(r.user.role).toBe('teacher');
        });

        test('creates admin with pending_approval=false', () => {
            const r = AuthHandler.register({ email: 'admin@school.com', password: 'pass', name: 'Admin', role: 'admin' });
            expect(r.success).toBe(true);
            expect(r.pending_approval).toBe(false);
        });

        test('rejects duplicate email (pending approval)', () => {
            AuthHandler.register({ email: 'dup@test.com', password: 'p', name: 'A' });
            const r = AuthHandler.register({ email: 'dup@test.com', password: 'p', name: 'A' });
            expect(r.success).toBe(false);
            expect(r.error).toContain('pending approval');
        });

        test('rejects duplicate email (approved user)', () => {
            UserRepository.create({ email: 'approved@test.com', name: 'X', role: 'admin', is_approved: true, password_hash: sha256('p') });
            const r = AuthHandler.register({ email: 'approved@test.com', password: 'p', name: 'X' });
            expect(r.success).toBe(false);
            expect(r.error).toContain('already registered');
        });

        test('rejects previously rejected email', () => {
            UserRepository.create({ email: 'rej@test.com', name: 'R', role: 'parent', rejected_at: '2024-01-01', password_hash: sha256('p') });
            const r = AuthHandler.register({ email: 'rej@test.com', password: 'p', name: 'R' });
            expect(r.success).toBe(false);
            expect(r.error).toContain('rejected');
        });

        test('assigns default role for invalid role', () => {
            const r = AuthHandler.register({ email: 'x@test.com', password: 'p', name: 'X', role: 'hacker' });
            expect(r.success).toBe(true);
            expect(r.user.role).toBe('parent'); // fallback
        });
    });

    // ─── login ────────────────────────────────────────────────────────────────

    describe('login', () => {
        beforeEach(() => {
            UserRepository.create({ email: 'active@school.com', name: 'Active', role: 'admin', is_approved: true, password_hash: sha256('secret') });
            UserRepository.create({ email: 'pending@school.com', name: 'Pending', role: 'teacher', is_approved: false, password_hash: sha256('pass') });
            UserRepository.create({ email: 'rejected@school.com', name: 'Rej', role: 'parent', is_approved: false, rejected_at: '2024', password_hash: sha256('p') });
        });

        test('requires email and password', () => {
            expect(AuthHandler.login({}).success).toBe(false);
            expect(AuthHandler.login({ email: 'x@y.com' }).success).toBe(false);
        });

        test('rejects unknown email', () => {
            expect(AuthHandler.login({ email: 'unknown@test.com', password: 'x' }).success).toBe(false);
        });

        test('rejects pending users', () => {
            const r = AuthHandler.login({ email: 'pending@school.com', password: 'pass' });
            expect(r.success).toBe(false);
            expect(r.error).toContain('pending');
        });

        test('rejects rejected users', () => {
            const r = AuthHandler.login({ email: 'rejected@school.com', password: 'p' });
            expect(r.success).toBe(false);
            expect(r.error).toContain('rejected');
        });

        test('rejects wrong password', () => {
            const r = AuthHandler.login({ email: 'active@school.com', password: 'wrong' });
            expect(r.success).toBe(false);
            expect(r.error).toContain('Invalid credentials');
        });

        test('returns a JWT on successful login', () => {
            const r = AuthHandler.login({ email: 'active@school.com', password: 'secret' });
            expect(r.success).toBe(true);
            expect(r.token).toBeDefined();
            expect(r.token.split('.')).toHaveLength(3);
        });
    });

    // ─── logout ───────────────────────────────────────────────────────────────

    describe('logout', () => {
        test('requires token', () => {
            expect(AuthHandler.logout(null).success).toBe(false);
        });

        test('fails for non-existent session', () => {
            expect(AuthHandler.logout('bad-token').success).toBe(false);
        });

        test('succeeds for an active session', () => {
            SessionRepository._sessions['valid-tok'] = true;
            const r = AuthHandler.logout('valid-tok');
            expect(r.success).toBe(true);
        });
    });

    // ─── verify ───────────────────────────────────────────────────────────────

    describe('verify', () => {
        test('requires token', () => {
            const r = AuthHandler.verify(null);
            expect(r.valid).toBe(false);
            expect(r.error).toContain('Token is required');
        });

        test('returns valid=true for a fresh token', () => {
            const token = createJWT({ userId: 'u1', email: 'a@b.com', role: 'admin', name: 'Admin' }, 'test-secret', 60);
            const r = AuthHandler.verify(token);
            expect(r.valid).toBe(true);
            expect(r.user.role).toBe('admin');
        });

        test('returns valid=false for tampered token', () => {
            const token = createJWT({ userId: 'u1', email: 'a@b.com', role: 'admin', name: 'A' }, 'test-secret') + 'tamper';
            const r = AuthHandler.verify(token);
            expect(r.valid).toBe(false);
        });

        test('returns expired=true for expired token', () => {
            const token = createJWT({ userId: 'u1', email: 'a@b.com', role: 'admin', name: 'A' }, 'test-secret', -1);
            const r = AuthHandler.verify(token);
            expect(r.valid).toBe(false);
            expect(r.expired).toBe(true);
        });
    });

    // ─── isAdmin ──────────────────────────────────────────────────────────────

    describe('isAdmin', () => {
        test('returns false for null token', () => {
            expect(AuthHandler.isAdmin(null)).toBe(false);
        });

        test('returns false for non-admin token', () => {
            const token = createJWT({ userId: 'u2', email: 'b@b.com', role: 'teacher', name: 'T' }, 'test-secret');
            expect(AuthHandler.isAdmin(token)).toBe(false);
        });

        test('returns true for admin token', () => {
            const token = createJWT({ userId: 'u1', email: 'a@b.com', role: 'admin', name: 'A' }, 'test-secret');
            expect(AuthHandler.isAdmin(token)).toBe(true);
        });
    });
});
