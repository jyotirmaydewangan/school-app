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
});
