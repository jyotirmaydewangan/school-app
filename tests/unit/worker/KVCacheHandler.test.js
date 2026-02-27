import { KVCacheHandler } from '../../../worker/src/cache/KVCacheHandler';
import { CacheConfig, CACHE_SCOPES } from '../../../worker/src/cache/CacheConfig';

describe('KVCacheHandler', () => {
    beforeEach(() => {
        global.MockKV.data.clear();
        KVCacheHandler.init({
            DATA_CACHE: global.MockKV,
            ENABLE_KV_CACHE: true
        });
    });

    // ─── Key Generation ────────────────────────────────────────────────────────

    describe('buildKeyForAction', () => {
        test('broad actions always produce the same key regardless of query params', () => {
            const key1 = KVCacheHandler.buildKeyForAction('t1', 'getStudents', { queryParams: { status: 'pending' } });
            const key2 = KVCacheHandler.buildKeyForAction('t1', 'getStudents', { queryParams: { status: 'approved' } });
            expect(key1).toBe(key2);
            expect(key1).toBe('cache:v6:t1:getStudents');
        });

        test('user-scoped actions include a token suffix', () => {
            // getAttendance is USER scope
            const token = 'mock_token_suffix_user1'; // last 8 chars = "ix_user1"
            const key = KVCacheHandler.buildKeyForAction('t1', 'getAttendance', { queryParams: {}, token });
            expect(key).toContain(':uix_user1');
        });

        test('user-scoped actions with different tokens produce different keys', () => {
            const k1 = KVCacheHandler.buildKeyForAction('t1', 'getAttendance', { queryParams: { class: 'A' }, token: 'tokAAAAAuser1' });
            const k2 = KVCacheHandler.buildKeyForAction('t1', 'getAttendance', { queryParams: { class: 'A' }, token: 'tokAAAAAuser2' });
            expect(k1).not.toBe(k2);
        });

        test('non-broad actions with different params produce different hashed keys', () => {
            const k1 = KVCacheHandler.buildKeyForAction('t1', 'getAttendance', { queryParams: { class: 'A' }, token: 'same_suffix_tok' });
            const k2 = KVCacheHandler.buildKeyForAction('t1', 'getAttendance', { queryParams: { class: 'B' }, token: 'same_suffix_tok' });
            expect(k1).not.toBe(k2);
            expect(k1).toContain(':h');
            expect(k2).toContain(':h');
        });

        test('ignored params (token, action, etc.) are not in the hash', () => {
            // The 'token' param in queryParams should be ignored during hashing
            const k1 = KVCacheHandler.buildKeyForAction('t1', 'getAttendance', { queryParams: { class: 'A', token: 'abc' }, token: 'same_suffix_tok' });
            const k2 = KVCacheHandler.buildKeyForAction('t1', 'getAttendance', { queryParams: { class: 'A', token: 'xyz' }, token: 'same_suffix_tok' });
            expect(k1).toBe(k2);
        });
    });

    // ─── _simpleHash ───────────────────────────────────────────────────────────

    describe('_simpleHash', () => {
        test('same string always produces same hash', () => {
            expect(KVCacheHandler._simpleHash('hello')).toBe(KVCacheHandler._simpleHash('hello'));
        });

        test('different strings produce different hashes', () => {
            expect(KVCacheHandler._simpleHash('hello')).not.toBe(KVCacheHandler._simpleHash('world'));
        });

        test('returns a non-empty string', () => {
            const h = KVCacheHandler._simpleHash('test');
            expect(typeof h).toBe('string');
            expect(h.length).toBeGreaterThan(0);
        });
    });

    // ─── filterData ────────────────────────────────────────────────────────────

    describe('filterData', () => {
        const rows = [
            { id: 1, name: 'Alice', status: 'pending', class: 'A' },
            { id: 2, name: 'Bob', status: 'approved', class: 'A' },
            { id: 3, name: 'Charlie', status: 'pending', class: 'B' }
        ];

        test('no filters → returns all items untouched', () => {
            expect(KVCacheHandler.filterData(rows, {}, 'getStudents')).toEqual(rows);
        });

        test('single filter → returns matching items only', () => {
            const r = KVCacheHandler.filterData(rows, { status: 'pending' }, 'getStudents');
            expect(r).toHaveLength(2);
            expect(r.every(i => i.status === 'pending')).toBe(true);
        });

        test('multiple filters → AND logic', () => {
            const r = KVCacheHandler.filterData(rows, { status: 'pending', class: 'A' }, 'getStudents');
            expect(r).toHaveLength(1);
            expect(r[0].name).toBe('Alice');
        });

        test('filter on missing property → row is not excluded (permissive)', () => {
            const r = KVCacheHandler.filterData(rows, { nonExistent: 'x' }, 'getStudents');
            expect(r).toHaveLength(3); // property doesn't exist → filter skipped
        });

        test('filters nested arrays inside objects', () => {
            const obj = { students: rows, meta: 'info' };
            const r = KVCacheHandler.filterData(obj, { class: 'B' }, 'any');
            expect(r.students).toHaveLength(1);
            expect(r.meta).toBe('info');
        });

        test('primitive data returned as-is', () => {
            expect(KVCacheHandler.filterData('raw', {}, 'x')).toBe('raw');
        });
    });

    // ─── setByKey / getByKey ───────────────────────────────────────────────────

    describe('setByKey (error guards)', () => {
        test('does NOT cache when success === false', async () => {
            const key = 'test-error-key';
            await KVCacheHandler.setByKey(key, { success: false, error: 'Unauthorized' }, 'getStudents');
            expect(global.MockKV.data.has(key)).toBe(false);
        });

        test('does NOT cache when error field is present (even if success is true)', async () => {
            const key = 'test-soft-error';
            await KVCacheHandler.setByKey(key, { success: true, error: 'some warning' }, 'getStudents');
            expect(global.MockKV.data.has(key)).toBe(false);
        });

        test('does NOT cache null data', async () => {
            const key = 'test-null-key';
            await KVCacheHandler.setByKey(key, null, 'getStudents');
            expect(global.MockKV.data.has(key)).toBe(false);
        });

        test('caches valid success response with a TTL envelope', async () => {
            const key = KVCacheHandler.buildKeyForAction('t1', 'getStudents', {});
            const data = { success: true, students: [{ id: 1, name: 'Alice' }] };
            await KVCacheHandler.setByKey(key, data, 'getStudents');
            const stored = await global.MockKV.get(key, 'json');
            expect(stored).not.toBeNull();
            expect(stored.data).toEqual(data);
            expect(stored.expiresAt).toBeGreaterThan(Date.now());
        });
    });

    // ─── get (full round-trip) ─────────────────────────────────────────────────

    describe('get', () => {
        test('returns null when KV is disabled', async () => {
            KVCacheHandler.init({ DATA_CACHE: global.MockKV, ENABLE_KV_CACHE: false });
            const r = await KVCacheHandler.get('t1', 'getStudents', {});
            expect(r).toBeNull();
        });

        test('returns null on cache miss', async () => {
            const r = await KVCacheHandler.get('t1', 'getStudents', {});
            expect(r).toBeNull();
        });

        test('returns data with isStale=false for fresh entry', async () => {
            const key = KVCacheHandler.buildKeyForAction('t1', 'getStudents', {});
            const entry = {
                data: { success: true, students: [] },
                createdAt: Date.now(),
                staleAt: Date.now() + 1_000_000,
                expiresAt: Date.now() + 2_000_000
            };
            await global.MockKV.put(key, JSON.stringify(entry));
            const r = await KVCacheHandler.get('t1', 'getStudents', {});
            expect(r).not.toBeNull();
            expect(r.isStale).toBe(false);
        });

        test('returns data with isStale=true for stale-but-not-expired entry', async () => {
            const key = KVCacheHandler.buildKeyForAction('t1', 'getStudents', {});
            const entry = {
                data: { success: true, students: [{ id: 1 }] },
                createdAt: Date.now() - 200_000,
                staleAt: Date.now() - 100_000,     // stale
                expiresAt: Date.now() + 100_000    // not yet expired
            };
            await global.MockKV.put(key, JSON.stringify(entry));
            const r = await KVCacheHandler.get('t1', 'getStudents', {});
            expect(r.isStale).toBe(true);
        });

        test('treats empty cached arrays as a miss and deletes the key', async () => {
            const key = KVCacheHandler.buildKeyForAction('t1', 'getStudents', {});
            const entry = {
                data: [],
                createdAt: Date.now(),
                staleAt: Date.now() + 1_000_000,
                expiresAt: Date.now() + 2_000_000
            };
            await global.MockKV.put(key, JSON.stringify(entry));
            const r = await KVCacheHandler.get('t1', 'getStudents', {});
            expect(r).toBeNull();
            // key should have been purged
            expect(global.MockKV.data.has(key)).toBe(false);
        });
    });

    // ─── invalidate ────────────────────────────────────────────────────────────

    describe('invalidate', () => {
        test('deletes all keys matching the action prefix', async () => {
            const k1 = KVCacheHandler.buildKeyForAction('t1', 'getStudents', {});
            const k2 = KVCacheHandler.buildKeyForAction('t1', 'getClasses', {});
            global.MockKV.data.set(k1, '{}');
            global.MockKV.data.set(k2, '{}');

            await KVCacheHandler.invalidate('t1', 'getStudents');

            expect(global.MockKV.data.has(k1)).toBe(false);
            expect(global.MockKV.data.has(k2)).toBe(true); // unrelated key untouched
        });

        test('does nothing when KV is disabled', async () => {
            KVCacheHandler.init({ DATA_CACHE: global.MockKV, ENABLE_KV_CACHE: false });
            const k = 'cache:v6:t1:getStudents';
            global.MockKV.data.set(k, '{}');
            await KVCacheHandler.invalidate('t1', 'getStudents');
            expect(global.MockKV.data.has(k)).toBe(true); // not deleted
        });
    });

    // ─── invalidateByPattern ───────────────────────────────────────────────────

    describe('invalidateByPattern', () => {
        test('invalidates multiple actions at once', async () => {
            const k1 = KVCacheHandler.buildKeyForAction('t1', 'getStudents', {});
            const k2 = KVCacheHandler.buildKeyForAction('t1', 'getClasses', {});
            global.MockKV.data.set(k1, '{}');
            global.MockKV.data.set(k2, '{}');

            await KVCacheHandler.invalidateByPattern('t1', ['getStudents', 'getClasses']);

            expect(global.MockKV.data.has(k1)).toBe(false);
            expect(global.MockKV.data.has(k2)).toBe(false);
        });

        test('handles null/empty patterns gracefully', async () => {
            await expect(KVCacheHandler.invalidateByPattern('t1', null)).resolves.toBeUndefined();
            await expect(KVCacheHandler.invalidateByPattern('t1', [])).resolves.toBeUndefined();
        });
    });

    // ─── isEnabled ─────────────────────────────────────────────────────────────

    describe('isEnabled', () => {
        test('returns false when KV is null', () => {
            KVCacheHandler.init({ DATA_CACHE: null, ENABLE_KV_CACHE: true });
            expect(KVCacheHandler.isEnabled()).toBe(false);
        });

        test('returns false when ENABLE_KV_CACHE is off', () => {
            KVCacheHandler.init({ DATA_CACHE: global.MockKV, ENABLE_KV_CACHE: 'false' });
            expect(KVCacheHandler.isEnabled()).toBe(false);
        });

        test('returns true for ENABLE_KV_CACHE = "1"', () => {
            KVCacheHandler.init({ DATA_CACHE: global.MockKV, ENABLE_KV_CACHE: '1' });
            expect(KVCacheHandler.isEnabled()).toBe(true);
        });
    });
});
