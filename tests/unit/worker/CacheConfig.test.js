import { CacheConfig, CACHE_SCOPES } from '../../../worker/src/cache/CacheConfig';

describe('CacheConfig', () => {
    test('should return correct rule for known actions (case-insensitive)', () => {
        const getUsersRule = CacheConfig.getRule('getUsers');
        const getUsersLower = CacheConfig.getRule('getusers');

        expect(getUsersRule).toBeDefined();
        expect(getUsersRule.isBroad).toBe(true);
        expect(getUsersLower).toEqual(getUsersRule);
    });

    test('should return null for unknown actions', () => {
        expect(CacheConfig.getRule('unknownAction')).toBeNull();
    });

    test('should return correct TTL', () => {
        // getSchools is static data -> ONE_MONTH (2592000)
        expect(CacheConfig.getTTL('getSchools')).toBe(2592000);
        // getPendingRegistrations is system data -> ONE_MIN (60)
        expect(CacheConfig.getTTL('getPendingRegistrations')).toBe(60);
        // unknown action -> default ONE_MONTH
        expect(CacheConfig.getTTL('random')).toBe(2592000);
    });

    test('should return correct scope', () => {
        expect(CacheConfig.getScope('getAttendance')).toBe(CACHE_SCOPES.USER);
        expect(CacheConfig.getScope('getSchools')).toBe(CACHE_SCOPES.GLOBAL);
        expect(CacheConfig.getScope('verify')).toBe(CACHE_SCOPES.SESSION);
    });

    test('should identified broad actions correctly', () => {
        expect(CacheConfig.isBroad('getStudents')).toBe(true);
        expect(CacheConfig.isBroad('getAttendance')).toBe(false);
    });

    test('should return correct invalidation patterns', () => {
        const patterns = CacheConfig.getInvalidatePatterns('createClass');
        expect(patterns).toContain('getClasses');
    });

    test('should return empty array for actions with no invalidation config', () => {
        expect(CacheConfig.getInvalidatePatterns('someReadAction')).toEqual([]);
    });

    test('should handle isPostReadAction correctly', () => {
        expect(CacheConfig.isPostReadAction('getUsers')).toBe(true);
        expect(CacheConfig.isPostReadAction('unknownAction')).toBe(false);
    });

    test('should handle all invoice-related actions', () => {
        expect(CacheConfig.getRule('getInvoices')).toBeDefined();
        expect(CacheConfig.getScope('getInvoices')).toBe(CACHE_SCOPES.USER);
        expect(CacheConfig.getRule('getAllInvoices')).toBeDefined();
        expect(CacheConfig.getScope('getAllInvoices')).toBe(CACHE_SCOPES.GLOBAL);
        expect(CacheConfig.getRule('getDefaulterList')).toBeDefined();
        expect(CacheConfig.getRule('getFeeStructures')).toBeDefined();
        expect(CacheConfig.getRule('getFeeDashboardStats')).toBeDefined();
        expect(CacheConfig.getRule('getPaymentAnalytics')).toBeDefined();
    });

    test('should handle all invoice-related actions', () => {
        expect(CacheConfig.getRule('getInvoices')).toBeDefined();
        expect(CacheConfig.getScope('getInvoices')).toBe(CACHE_SCOPES.USER);
        expect(CacheConfig.getRule('getAllInvoices')).toBeDefined();
        expect(CacheConfig.getScope('getAllInvoices')).toBe(CACHE_SCOPES.GLOBAL);
        expect(CacheConfig.getRule('getDefaulterList')).toBeDefined();
        expect(CacheConfig.getRule('getFeeStructures')).toBeDefined();
        expect(CacheConfig.getRule('getFeeDashboardStats')).toBeDefined();
        expect(CacheConfig.getRule('getPaymentAnalytics')).toBeDefined();
    });

    test('should have correct invalidation patterns for notices', () => {
        expect(CacheConfig.getInvalidatePatterns('createNotice')).toContain('getNotices');
        expect(CacheConfig.getInvalidatePatterns('deleteNotice')).toContain('getNotices');
    });

    test('should have correct invalidation patterns for marks', () => {
        expect(CacheConfig.getInvalidatePatterns('enterMarks')).toContain('getMarks');
        expect(CacheConfig.getInvalidatePatterns('enterMarks')).toContain('getDashboardStats');
    });

    test('should handle write request detection', () => {
        expect(CacheConfig.shouldCache('getUsers')).toBe(true);
        expect(CacheConfig.shouldCache('createUser')).toBe(false);
        expect(CacheConfig.shouldCache('unknown')).toBe(false);
    });
});
