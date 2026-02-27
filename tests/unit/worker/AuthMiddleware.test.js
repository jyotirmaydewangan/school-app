import { AuthMiddleware } from '../../../worker/src/middleware/AuthMiddleware';

describe('AuthMiddleware', () => {
    // Helper to create a mock Request object
    const makeRequest = (url, headers = {}) => ({
        url,
        headers: {
            get: (key) => headers[key] || headers[key.toLowerCase()] || null
        }
    });

    // ─── extractToken ─────────────────────────────────────────────────────────

    describe('extractToken', () => {
        test('extracts token from Authorization header (Bearer)', () => {
            const req = makeRequest('https://example.com/getUsers', {
                Authorization: 'Bearer my-jwt-token'
            });
            expect(AuthMiddleware.extractToken(req)).toBe('my-jwt-token');
        });

        test('extracts token from query param if no Authorization header', () => {
            const req = makeRequest('https://example.com/getUsers?token=my-query-token');
            expect(AuthMiddleware.extractToken(req)).toBe('my-query-token');
        });

        test('prefers Authorization header over query param', () => {
            const req = makeRequest('https://example.com/getUsers?token=query-token', {
                Authorization: 'Bearer header-token'
            });
            expect(AuthMiddleware.extractToken(req)).toBe('header-token');
        });

        test('returns null when no token present in either location', () => {
            const req = makeRequest('https://example.com/getUsers');
            expect(AuthMiddleware.extractToken(req)).toBeNull();
        });

        test('strips only the "Bearer " prefix, nothing else', () => {
            const req = makeRequest('https://example.com', {
                Authorization: 'Bearer abc.def.ghi'
            });
            expect(AuthMiddleware.extractToken(req)).toBe('abc.def.ghi');
        });
    });

    // ─── addTokenToBody ───────────────────────────────────────────────────────

    describe('addTokenToBody', () => {
        test('injects token into valid JSON body', () => {
            const body = JSON.stringify({ name: 'Alice' });
            const result = JSON.parse(AuthMiddleware.addTokenToBody(body, 'tok123'));
            expect(result.token).toBe('tok123');
            expect(result.name).toBe('Alice');
        });

        test('returns original body when token is null', () => {
            const body = JSON.stringify({ name: 'Alice' });
            expect(AuthMiddleware.addTokenToBody(body, null)).toBe(body);
        });

        test('returns original body when body is null/empty', () => {
            expect(AuthMiddleware.addTokenToBody(null, 'tok')).toBeNull();
            expect(AuthMiddleware.addTokenToBody('', 'tok')).toBe('');
        });

        test('returns original body when body is invalid JSON', () => {
            const invalid = 'not-json-{{';
            expect(AuthMiddleware.addTokenToBody(invalid, 'tok')).toBe(invalid);
        });

        test('overwrites existing token in body with the new one', () => {
            const body = JSON.stringify({ token: 'old-token', data: 1 });
            const result = JSON.parse(AuthMiddleware.addTokenToBody(body, 'new-token'));
            expect(result.token).toBe('new-token');
        });
    });

    // ─── isAuthRequired ───────────────────────────────────────────────────────

    describe('isAuthRequired', () => {
        test('returns false for public actions: login, register, verify', () => {
            expect(AuthMiddleware.isAuthRequired('login')).toBe(false);
            expect(AuthMiddleware.isAuthRequired('register')).toBe(false);
            expect(AuthMiddleware.isAuthRequired('verify')).toBe(false);
        });

        test('returns true for all protected actions', () => {
            expect(AuthMiddleware.isAuthRequired('getUsers')).toBe(true);
            expect(AuthMiddleware.isAuthRequired('getStudents')).toBe(true);
            expect(AuthMiddleware.isAuthRequired('createClass')).toBe(true);
            expect(AuthMiddleware.isAuthRequired('deleteSchool')).toBe(true);
            expect(AuthMiddleware.isAuthRequired('approveUser')).toBe(true);
            expect(AuthMiddleware.isAuthRequired('enterMarks')).toBe(true);
        });
    });
});
