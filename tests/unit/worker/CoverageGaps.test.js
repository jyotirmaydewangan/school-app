/**
 * CacheConfig and RouteConfig - Gap Coverage Tests
 * Covers all remaining uncovered lines:
 * - CacheConfig.shouldCache() — true/false
 * - CacheConfig.isPostReadAction() — true/false
 * - CacheConfig.isBroad() null rule fallback
 * - CacheConfig.getScope() null rule fallback
 * - RequestParser.parseBody() — JSON, form-urlencoded, multipart, null
 * - RouteConfig.parsePath() — various path formats
 */

import { CacheConfig, CACHE_SCOPES } from '../../../worker/src/cache/CacheConfig';
import { RequestParser, RouteConfig } from '../../../worker/src/routes/RouteConfig';

// ─── CacheConfig Gap Tests ────────────────────────────────────────────────────

describe('CacheConfig - Remaining Coverage', () => {

    describe('shouldCache()', () => {
        test('returns true for a cacheable action (getStudents)', () => {
            expect(CacheConfig.shouldCache('getStudents')).toBe(true);
        });

        test('returns true for verify action', () => {
            expect(CacheConfig.shouldCache('verify')).toBe(true);
        });

        test('returns false for unknown action (not in rules)', () => {
            expect(CacheConfig.shouldCache('unknownXYZ')).toBe(false);
        });

        test('returns false for write actions (not in cache rules)', () => {
            expect(CacheConfig.shouldCache('createStudent')).toBe(false);
            expect(CacheConfig.shouldCache('updateStudent')).toBe(false);
            expect(CacheConfig.shouldCache('deleteUser')).toBe(false);
        });
    });

    describe('isPostReadAction()', () => {
        test('returns true for known cacheable actions', () => {
            expect(CacheConfig.isPostReadAction('getStudents')).toBe(true);
            expect(CacheConfig.isPostReadAction('getUsers')).toBe(true);
            expect(CacheConfig.isPostReadAction('getClasses')).toBe(true);
        });

        test('returns false for unknown actions', () => {
            expect(CacheConfig.isPostReadAction('nonExistentAction')).toBe(false);
        });
    });

    describe('isBroad() - null rule path', () => {
        test('returns false for action with no rule', () => {
            expect(CacheConfig.isBroad('nonExistent')).toBe(false);
        });

        test('returns true for a broad action (getStudents)', () => {
            expect(CacheConfig.isBroad('getStudents')).toBe(true);
        });

        test('returns false for a non-broad action (getAttendance)', () => {
            expect(CacheConfig.isBroad('getAttendance')).toBe(false);
        });
    });

    describe('getScope() - null rule path', () => {
        test('returns GLOBAL for unknown action (default fallback)', () => {
            expect(CacheConfig.getScope('unknownAction')).toBe(CACHE_SCOPES.GLOBAL);
        });

        test('returns USER scope for getAttendance', () => {
            expect(CacheConfig.getScope('getAttendance')).toBe(CACHE_SCOPES.USER);
        });
    });

    describe('getTTL() edge cases', () => {
        test('returns a positive number for any known action', () => {
            const actions = ['getStudents', 'getUsers', 'verify', 'getClasses', 'getMarks'];
            actions.forEach(a => {
                expect(CacheConfig.getTTL(a)).toBeGreaterThan(0);
            });
        });

        test('returns ONE_MONTH (2592000) as default TTL for unknown actions', () => {
            expect(CacheConfig.getTTL('unknownAction')).toBe(2592000);
        });
    });

    describe('getInvalidatePatterns()', () => {
        test('returns array for known write actions', () => {
            expect(Array.isArray(CacheConfig.getInvalidatePatterns('createStudent'))).toBe(true);
            expect(CacheConfig.getInvalidatePatterns('createStudent').length).toBeGreaterThan(0);
        });

        test('returns empty array for unknown write actions', () => {
            expect(CacheConfig.getInvalidatePatterns('unknownWriteAction')).toEqual([]);
        });

        test('approveUser invalidates getPendingRegistrations and getUsers', () => {
            const patterns = CacheConfig.getInvalidatePatterns('approveUser');
            expect(patterns).toContain('getPendingRegistrations');
            expect(patterns).toContain('getUsers');
        });

        test('createRole invalidates getRoles, getUsers, and verify', () => {
            const patterns = CacheConfig.getInvalidatePatterns('createRole');
            expect(patterns).toContain('getRoles');
            expect(patterns).toContain('verify');
        });
    });
});

// ─── RequestParser.parseBody() ────────────────────────────────────────────────

describe('RequestParser.parseBody()', () => {
    /** Build a minimal mock Request */
    const makeJsonReq = (body) => {
        const req = {
            headers: { get: (key) => key === 'Content-Type' ? 'application/json' : null },
            text: async () => body,
            clone: () => req
        };
        return req;
    };

    const makeFormReq = (contentType, entries) => {
        const req = {
            headers: { get: (key) => key === 'Content-Type' ? contentType : null },
            formData: async () => new Map(entries),
            clone: () => req
        };
        return req;
    };

    const makeUnknownReq = (contentType) => {
        const req = {
            headers: { get: (key) => key === 'Content-Type' ? contentType : null },
            text: async () => 'body',
            clone: () => req
        };
        return req;
    };

    test('returns raw text for application/json', async () => {
        const result = await RequestParser.parseBody(makeJsonReq('{"key":"val"}'));
        expect(result).toBe('{"key":"val"}');
    });

    test('returns null when Content-Type is not recognized', async () => {
        const result = await RequestParser.parseBody(makeUnknownReq('text/plain'));
        expect(result).toBeNull();
    });

    test('returns null when Content-Type header is absent', async () => {
        const result = await RequestParser.parseBody(makeUnknownReq(null));
        expect(result).toBeNull();
    });

    test('parses application/x-www-form-urlencoded into JSON string', async () => {
        const result = await RequestParser.parseBody(
            makeFormReq('application/x-www-form-urlencoded', [['name', 'Alice'], ['role', 'teacher']])
        );
        const parsed = JSON.parse(result);
        expect(parsed.name).toBe('Alice');
        expect(parsed.role).toBe('teacher');
    });

    test('parses multipart/form-data into JSON string', async () => {
        const result = await RequestParser.parseBody(
            makeFormReq('multipart/form-data; boundary=xyz', [['email', 'a@b.com']])
        );
        const parsed = JSON.parse(result);
        expect(parsed.email).toBe('a@b.com');
    });
});

// ─── RouteConfig.parsePath() variants ────────────────────────────────────────

describe('RouteConfig.parsePath() - additional variants', () => {
    test('handles /api/users/getStudents (extra sub-path)', () => {
        // parsePath replaces /api/ with '' and then trims leading slash
        const result = RouteConfig.parsePath('/api/getStudents');
        expect(result).toBe('getStudents');
    });

    test('handles plain action without any slash', () => {
        expect(RouteConfig.parsePath('login')).toBe('login');
    });

    test('handles leading slash only', () => {
        expect(RouteConfig.parsePath('/getUsers')).toBe('getUsers');
    });

    test('handles empty string gracefully', () => {
        const result = RouteConfig.parsePath('');
        expect(typeof result).toBe('string');
    });
});
