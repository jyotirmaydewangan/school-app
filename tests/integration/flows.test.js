/**
 * Integration Flow Tests
 *
 * These tests exercise the 3 critical business flows end-to-end
 * through the Worker's KV caching layer, verifying data consistency.
 *
 * Dependencies:
 *  - KVCacheHandler (via import — Babel transforms automatically)
 *  - Global MockKV from tests/setup.js
 */

import { KVCacheHandler } from '../../worker/src/cache/KVCacheHandler';
import { CacheConfig } from '../../worker/src/cache/CacheConfig';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Store a pre-built master-list in the KV, simulating a warm cache. */
async function warmCache(tenantId, action, data) {
    const key = KVCacheHandler.buildKeyForAction(tenantId, action, {});
    const entry = {
        data,
        createdAt: Date.now(),
        staleAt: Date.now() + 1_800_000,
        expiresAt: Date.now() + 3_600_000
    };
    await global.MockKV.put(key, JSON.stringify(entry));
}

/** Simulate a mutation by calling invalidate on all affected actions. */
async function simulateMutation(tenantId, writeAction) {
    const patterns = CacheConfig.getInvalidatePatterns(writeAction);
    await KVCacheHandler.invalidateByPattern(tenantId, patterns);
}

// ─── Flow A: School Onboarding ────────────────────────────────────────────────

describe('Flow A: School Onboarding', () => {
    const TENANT = 'flow-onboard';

    beforeEach(async () => {
        global.MockKV.data.clear();
        KVCacheHandler.init({ DATA_CACHE: global.MockKV, ENABLE_KV_CACHE: true });
    });

    test('getSchools starts as a cache miss, then populates on first fetch', async () => {
        // 1. Cold cache → miss
        expect(await KVCacheHandler.get(TENANT, 'getSchools', {})).toBeNull();

        // 2. Simulate backend response and cache it
        const schools = [{ id: 'sch1', name: 'ABC School' }];
        await warmCache(TENANT, 'getSchools', schools);

        // 3. Hit → data matches
        const cached = await KVCacheHandler.get(TENANT, 'getSchools', {});
        expect(cached).not.toBeNull();
        expect(cached.data).toEqual(schools);
    });

    test('createSchool invalidates getSchools cache', async () => {
        await warmCache(TENANT, 'getSchools', [{ id: 'sch1', name: 'Old School' }]);
        expect(global.MockKV.data.size).toBe(1);

        await simulateMutation(TENANT, 'createSchool');
        expect(global.MockKV.data.size).toBe(0); // invalidated
    });

    test('createClass invalidates getClasses (not getSchools)', async () => {
        await warmCache(TENANT, 'getSchools', [{ id: 's1' }]);
        await warmCache(TENANT, 'getClasses', [{ id: 'c1' }]);
        expect(global.MockKV.data.size).toBe(2);

        await simulateMutation(TENANT, 'createClass');

        const schoolsCached = await KVCacheHandler.get(TENANT, 'getSchools', {});
        const classesCached = await KVCacheHandler.get(TENANT, 'getClasses', {});
        expect(schoolsCached).not.toBeNull(); // untouched
        expect(classesCached).toBeNull();     // invalidated
    });

    test('createSection invalidates getSections (not getClasses)', async () => {
        await warmCache(TENANT, 'getClasses', [{ id: 'c1' }]);
        await warmCache(TENANT, 'getSections', [{ id: 'sec1' }]);

        await simulateMutation(TENANT, 'createSection');

        expect(await KVCacheHandler.get(TENANT, 'getClasses', {})).not.toBeNull();
        expect(await KVCacheHandler.get(TENANT, 'getSections', {})).toBeNull();
    });
});

// ─── Flow B: Academic Cycle ───────────────────────────────────────────────────

describe('Flow B: Academic Cycle', () => {
    const TENANT = 'flow-academic';

    beforeEach(async () => {
        global.MockKV.data.clear();
        KVCacheHandler.init({ DATA_CACHE: global.MockKV, ENABLE_KV_CACHE: true });
    });

    test('createSubject invalidates getSubjects', async () => {
        await warmCache(TENANT, 'getSubjects', [{ id: 'sub1', name: 'Math' }]);
        await simulateMutation(TENANT, 'createSubject');
        expect(await KVCacheHandler.get(TENANT, 'getSubjects', {})).toBeNull();
    });

    test('addSyllabus invalidates getSyllabus', async () => {
        await warmCache(TENANT, 'getSyllabus', [{ id: 'syl1', topic: 'Algebra' }]);
        await simulateMutation(TENANT, 'addSyllabus');
        expect(await KVCacheHandler.get(TENANT, 'getSyllabus', {})).toBeNull();
    });

    test('createExam invalidates getExams', async () => {
        await warmCache(TENANT, 'getExams', [{ id: 'ex1', name: 'Midterm' }]);
        await simulateMutation(TENANT, 'createExam');
        expect(await KVCacheHandler.get(TENANT, 'getExams', {})).toBeNull();
    });

    test('enterMarks invalidates getMarks', async () => {
        await warmCache(TENANT, 'getMarks', { marks: [] });
        await simulateMutation(TENANT, 'enterMarks');
        expect(await KVCacheHandler.get(TENANT, 'getMarks', {})).toBeNull();
    });

    test('markAttendance invalidates getAttendance and getAttendanceSummary', async () => {
        await warmCache(TENANT, 'getAttendance', []);
        await warmCache(TENANT, 'getAttendanceSummary', {});

        // Mark attendance — should wipe both
        await simulateMutation(TENANT, 'markAttendance');

        expect(await KVCacheHandler.get(TENANT, 'getAttendance', {})).toBeNull();
        expect(await KVCacheHandler.get(TENANT, 'getAttendanceSummary', {})).toBeNull();
    });
});

// ─── Flow C: Cache Consistency (Broad Filtering) ─────────────────────────────

describe('Flow C: Cache Consistency (Broad Filtering)', () => {
    const TENANT = 'flow-cache';

    beforeEach(() => {
        global.MockKV.data.clear();
        KVCacheHandler.init({ DATA_CACHE: global.MockKV, ENABLE_KV_CACHE: true });
    });

    const allStudents = [
        { id: 's1', name: 'Alice', status: 'pending', class: '5A' },
        { id: 's2', name: 'Bob', status: 'approved', class: '5A' },
        { id: 's3', name: 'Carol', status: 'pending', class: '6B' }
    ];

    test('filterData correctly narrows the broad master list for pending students', () => {
        const filtered = KVCacheHandler.filterData(allStudents, { status: 'pending' }, 'getStudents');
        expect(filtered).toHaveLength(2);
        expect(filtered.map(s => s.name)).toEqual(['Alice', 'Carol']);
    });

    test('filterData returns class-specific subset from master list', () => {
        const filtered = KVCacheHandler.filterData(allStudents, { class: '5A' }, 'getStudents');
        expect(filtered).toHaveLength(2);
        expect(filtered.every(s => s.class === '5A')).toBe(true);
    });

    test('filterData + nested status filter returns exactly 1 student', () => {
        const filtered = KVCacheHandler.filterData(allStudents, { status: 'approved', class: '5A' }, 'getStudents');
        expect(filtered).toHaveLength(1);
        expect(filtered[0].name).toBe('Bob');
    });

    test('after updateStudent, getStudents cache is invalidated (no stale data)', async () => {
        // 1. Warm cache with old data
        await warmCache(TENANT, 'getStudents', allStudents);

        // 2. Simulate an update
        await simulateMutation(TENANT, 'updateStudent');

        // 3. Cache must now be empty → next request will fetch fresh from backend
        const result = await KVCacheHandler.get(TENANT, 'getStudents', {});
        expect(result).toBeNull();
    });

    test('approveStudent invalidates getStudents', async () => {
        await warmCache(TENANT, 'getStudents', allStudents);
        await simulateMutation(TENANT, 'approveStudent');
        expect(await KVCacheHandler.get(TENANT, 'getStudents', {})).toBeNull();
    });

    test('linkParentStudent invalidates getLinkedStudents (not getStudents)', async () => {
        await warmCache(TENANT, 'getStudents', allStudents);
        await warmCache(TENANT, 'getLinkedStudents', []);

        await simulateMutation(TENANT, 'linkParentStudent');

        expect(await KVCacheHandler.get(TENANT, 'getStudents', {})).not.toBeNull();   // untouched
        expect(await KVCacheHandler.get(TENANT, 'getLinkedStudents', {})).toBeNull(); // invalidated
    });

    test('multiple mutations are independent — only targeted caches evicted', async () => {
        await warmCache(TENANT, 'getStudents', allStudents);
        await warmCache(TENANT, 'getClasses', [{ id: 'c1' }]);
        await warmCache(TENANT, 'getSections', [{ id: 'sec1' }]);

        await simulateMutation(TENANT, 'updateStudent');

        // Only getStudents cache should be gone
        expect(await KVCacheHandler.get(TENANT, 'getStudents', {})).toBeNull();
        expect(await KVCacheHandler.get(TENANT, 'getClasses', {})).not.toBeNull();
        expect(await KVCacheHandler.get(TENANT, 'getSections', {})).not.toBeNull();
    });
});

// ─── Flow D: User & Role Management ──────────────────────────────────────────

describe('Flow D: User & Role Management', () => {
    const TENANT = 'flow-users';

    beforeEach(() => {
        global.MockKV.data.clear();
        KVCacheHandler.init({ DATA_CACHE: global.MockKV, ENABLE_KV_CACHE: true });
    });

    test('approveUser invalidates getPendingRegistrations AND getUsers', async () => {
        await warmCache(TENANT, 'getPendingRegistrations', [{ id: 'u1' }]);
        await warmCache(TENANT, 'getUsers', [{ id: 'u2', is_approved: true }]);

        await simulateMutation(TENANT, 'approveUser');

        expect(await KVCacheHandler.get(TENANT, 'getPendingRegistrations', {})).toBeNull();
        expect(await KVCacheHandler.get(TENANT, 'getUsers', {})).toBeNull();
    });

    test('rejectUser only invalidates getPendingRegistrations', async () => {
        await warmCache(TENANT, 'getPendingRegistrations', [{ id: 'u1' }]);
        await warmCache(TENANT, 'getUsers', [{ id: 'u2', is_approved: true }]);

        await simulateMutation(TENANT, 'rejectUser');

        expect(await KVCacheHandler.get(TENANT, 'getPendingRegistrations', {})).toBeNull();
        expect(await KVCacheHandler.get(TENANT, 'getUsers', {})).not.toBeNull(); // untouched
    });

    test('createRole invalidates getRoles, getUsers, and verify', async () => {
        await warmCache(TENANT, 'getRoles', [{ id: 'r1' }]);
        await warmCache(TENANT, 'getUsers', [{ id: 'u1' }]);
        await warmCache(TENANT, 'verify', { valid: true });

        await simulateMutation(TENANT, 'createRole');

        expect(await KVCacheHandler.get(TENANT, 'getRoles', {})).toBeNull();
        expect(await KVCacheHandler.get(TENANT, 'getUsers', {})).toBeNull();
        expect(await KVCacheHandler.get(TENANT, 'verify', {})).toBeNull();
    });
});
