import { RouteConfig, RequestParser } from '../../../worker/src/routes/RouteConfig';

describe('RouteConfig', () => {
    // ─── parsePath ────────────────────────────────────────────────────────────

    describe('parsePath', () => {
        test('strips /api/ prefix from pathname', () => {
            expect(RouteConfig.parsePath('/api/getStudents')).toBe('getStudents');
        });

        test('strips leading slash without /api/', () => {
            expect(RouteConfig.parsePath('/getStudents')).toBe('getStudents');
        });

        test('returns action unchanged when no prefix', () => {
            expect(RouteConfig.parsePath('getStudents')).toBe('getStudents');
        });
    });

    // ─── parseMethod ─────────────────────────────────────────────────────────

    describe('parseMethod', () => {
        test('converts lowercase to uppercase', () => {
            expect(RouteConfig.parseMethod('get')).toBe('GET');
            expect(RouteConfig.parseMethod('post')).toBe('POST');
        });

        test('uppercase is unchanged', () => {
            expect(RouteConfig.parseMethod('DELETE')).toBe('DELETE');
        });
    });

    // ─── shouldHandle ─────────────────────────────────────────────────────────

    describe('shouldHandle', () => {
        test('returns true for supported methods', () => {
            ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'].forEach(m => {
                expect(RouteConfig.shouldHandle(m)).toBe(true);
            });
        });

        test('returns false for unsupported method', () => {
            expect(RouteConfig.shouldHandle('PATCH')).toBe(false);
            expect(RouteConfig.shouldHandle('HEAD')).toBe(false);
        });

        test('is case-insensitive', () => {
            expect(RouteConfig.shouldHandle('get')).toBe(true);
        });
    });

    // ─── isGetRequest ─────────────────────────────────────────────────────────

    describe('isGetRequest', () => {
        test('returns true only for GET', () => {
            expect(RouteConfig.isGetRequest('GET')).toBe(true);
            expect(RouteConfig.isGetRequest('get')).toBe(true);
            expect(RouteConfig.isGetRequest('POST')).toBe(false);
        });
    });

    // ─── isWriteRequest ───────────────────────────────────────────────────────

    describe('isWriteRequest', () => {
        test('returns true for POST, PUT, DELETE', () => {
            expect(RouteConfig.isWriteRequest('POST')).toBe(true);
            expect(RouteConfig.isWriteRequest('PUT')).toBe(true);
            expect(RouteConfig.isWriteRequest('DELETE')).toBe(true);
        });

        test('returns false for GET and OPTIONS', () => {
            expect(RouteConfig.isWriteRequest('GET')).toBe(false);
            expect(RouteConfig.isWriteRequest('OPTIONS')).toBe(false);
        });
    });
});

// ─── RequestParser ────────────────────────────────────────────────────────────

describe('RequestParser', () => {
    // ─── parseBody ────────────────────────────────────────────────────────────

    describe('parseBody', () => {
        test('parses JSON content type', async () => {
            const request = {
                headers: { get: () => 'application/json' },
                clone: () => ({
                    text: () => Promise.resolve(JSON.stringify({ foo: 'bar' }))
                })
            };
            const result = await RequestParser.parseBody(request);
            expect(result).toBe('{"foo":"bar"}');
        });

        test('returns null for unparseable JSON', async () => {
            const request = {
                headers: { get: () => 'application/json' },
                clone: () => ({
                    text: () => Promise.reject(new Error('Parse error'))
                })
            };
            const result = await RequestParser.parseBody(request);
            expect(result).toBeNull();
        });

        test('returns null for unsupported content type', async () => {
            const request = {
                headers: { get: () => 'text/plain' },
                clone: () => ({})
            };
            const result = await RequestParser.parseBody(request);
            expect(result).toBeNull();
        });
    });

    // ─── buildApiUrl ──────────────────────────────────────────────────────────

    describe('buildApiUrl', () => {
        test('builds URL with query params, action is always included', () => {
            const params = new URLSearchParams({ class: 'A', status: 'pending' });
            const url = RequestParser.buildApiUrl('https://script.google.com/exec', 'getStudents', params);
            expect(url).toContain('action=getStudents');
            expect(url).toContain('class=A');
            expect(url).toContain('status=pending');
        });

        test('excludes the action key from queryParams to avoid duplication', () => {
            const params = new URLSearchParams({ action: 'old', class: 'B' });
            const url = RequestParser.buildApiUrl('https://script.google.com/exec', 'getClasses', params);
            // 'action=getClasses' should appear exactly once
            expect((url.match(/action=/g) || []).length).toBe(1);
            expect(url).toContain('action=getClasses');
        });

        test('handles a scriptUrl that already has query string', () => {
            const params = new URLSearchParams({ class: 'C' });
            const url = RequestParser.buildApiUrl('https://script.google.com/exec?tenant=abc', 'getStudents', params);
            // Should use & not ? for appending
            expect(url).toContain('tenant=abc&');
            expect(url).toContain('action=getStudents');
        });

        test('works with empty queryParams', () => {
            const url = RequestParser.buildApiUrl('https://script.google.com/exec', 'login', new URLSearchParams());
            expect(url).toContain('action=login');
        });

        test('handles plain object as queryParams', () => {
            const params = { class: 'A', section: 'B', year: '2024' };
            const url = RequestParser.buildApiUrl('https://script.google.com/exec', 'getAttendanceByClass', params);
            expect(url).toContain('action=getAttendanceByClass');
            expect(url).toContain('class=A');
            expect(url).toContain('section=B');
            expect(url).toContain('year=2024');
        });

        test('filters out undefined and null values from object', () => {
            const params = { valid: 'yes', undef: undefined, nul: null };
            const url = RequestParser.buildApiUrl('https://script.google.com/exec', 'test', params);
            expect(url).toContain('valid=yes');
            expect(url).not.toContain('undef');
            expect(url).not.toContain('nul');
        });

        test('handles object with action key - excludes it', () => {
            const params = { action: 'wrong', name: 'test' };
            const url = RequestParser.buildApiUrl('https://script.google.com/exec', 'correctAction', params);
            expect(url).toContain('action=correctAction');
            expect(url).not.toContain('action=wrong');
        });
    });
});
