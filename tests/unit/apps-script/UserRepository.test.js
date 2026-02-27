/**
 * UserRepository - Comprehensive CRUD Tests
 * 
 * Uses an in-memory Google Sheets mock. Covers:
 * - findByEmail, findById, findAll (with pagination)
 * - create, update, updateRole, delete
 * - findPending, findRejected, approveUser, rejectUser, countPending
 * - existsByEmail
 */

const { createSheetDB } = require('../../mocks/SheetService.mock');

// ─── Rebuild the in-memory UserRepository ───────────────────────────────────
// We inline the repository logic so it runs against our mock SheetService
// identical to how it runs in the real Apps Script environment.

function buildUserRepository(SheetService, SHEET_NAMES, generateId, getCurrentTimestamp) {
    return {
        findByEmail(email) {
            const sheet = SheetService.getSheet(SHEET_NAMES.USERS);
            const data = sheet.getDataRange().getValues();
            for (let i = 1; i < data.length; i++) {
                if (data[i][1] === email) return this.mapToUser(data[i]);
            }
            return null;
        },

        findById(id) {
            const sheet = SheetService.getSheet(SHEET_NAMES.USERS);
            const data = sheet.getDataRange().getValues();
            for (let i = 1; i < data.length; i++) {
                if (data[i][0] === id) return this.mapToUser(data[i]);
            }
            return null;
        },

        findAll(options = {}) {
            const sheet = SheetService.getSheet(SHEET_NAMES.USERS);
            const data = sheet.getDataRange().getValues();
            const headers = data[0];
            let allUsers = [];
            for (let i = 1; i < data.length; i++) {
                const user = {};
                headers.forEach((h, idx) => user[h] = data[i][idx]);
                delete user.password_hash;
                allUsers.push(user);
            }
            const total = allUsers.length;
            let paginatedUsers = allUsers;
            if (options.limit && options.limit > 0) {
                const offset = options.offset || 0;
                paginatedUsers = allUsers.slice(offset, offset + options.limit);
            }
            return { users: paginatedUsers, pagination: { total, limit: options.limit || 0, offset: options.offset || 0, has_more: options.limit > 0 && ((options.offset || 0) + options.limit) < total } };
        },

        create(userData) {
            const sheet = SheetService.getSheet(SHEET_NAMES.USERS);
            const id = generateId();
            const now = getCurrentTimestamp();
            const isApproved = userData.role === 'admin' || userData.is_approved === true;
            sheet.appendRow([id, userData.email, userData.phone || '', userData.password_hash, userData.role || 'student', userData.name, isApproved, '', now, now]);
            return this.findById(id);
        },

        update(userId, userData) {
            const sheet = SheetService.getSheet(SHEET_NAMES.USERS);
            const data = sheet.getDataRange().getValues();
            for (let i = 1; i < data.length; i++) {
                if (data[i][0] === userId) {
                    const row = i + 1;
                    const now = getCurrentTimestamp();
                    if (userData.phone !== undefined) sheet.getRange(row, 3).setValue(userData.phone || '');
                    if (userData.password_hash) sheet.getRange(row, 4).setValue(userData.password_hash);
                    if (userData.role) sheet.getRange(row, 5).setValue(userData.role);
                    if (userData.name) sheet.getRange(row, 6).setValue(userData.name);
                    sheet.getRange(row, 10).setValue(now);
                    return this.findById(userId);
                }
            }
            return null;
        },

        updateRole(userId, newRole) {
            const sheet = SheetService.getSheet(SHEET_NAMES.USERS);
            const data = sheet.getDataRange().getValues();
            for (let i = 1; i < data.length; i++) {
                if (data[i][0] === userId) {
                    sheet.getRange(i + 1, 5).setValue(newRole);
                    sheet.getRange(i + 1, 10).setValue(getCurrentTimestamp());
                    return true;
                }
            }
            return false;
        },

        delete(userId) {
            const sheet = SheetService.getSheet(SHEET_NAMES.USERS);
            const data = sheet.getDataRange().getValues();
            for (let i = 1; i < data.length; i++) {
                if (data[i][0] === userId) { sheet.deleteRow(i + 1); return true; }
            }
            return false;
        },

        existsByEmail(email) { return this.findByEmail(email) !== null; },

        findPending(options = {}) {
            const sheet = SheetService.getSheet(SHEET_NAMES.USERS);
            const data = sheet.getDataRange().getValues();
            const headers = data[0];
            const pending = [];
            for (let i = 1; i < data.length; i++) {
                if (data[i][0] && !data[i][6] && !data[i][7]) {
                    const user = {};
                    headers.forEach((h, idx) => user[h] = data[i][idx]);
                    pending.push(user);
                }
            }
            let filtered = options.role ? pending.filter(u => u.role === options.role) : pending;
            const total = filtered.length;
            if (options.limit && options.limit > 0) {
                filtered = filtered.slice(options.offset || 0, (options.offset || 0) + options.limit);
            }
            return { users: filtered, total };
        },

        approveUser(userId) {
            const sheet = SheetService.getSheet(SHEET_NAMES.USERS);
            const data = sheet.getDataRange().getValues();
            for (let i = 1; i < data.length; i++) {
                if (data[i][0] === userId) {
                    sheet.getRange(i + 1, 7).setValue(true);
                    sheet.getRange(i + 1, 8).setValue('');
                    sheet.getRange(i + 1, 10).setValue(getCurrentTimestamp());
                    return this.findById(userId);
                }
            }
            return null;
        },

        rejectUser(userId) {
            const sheet = SheetService.getSheet(SHEET_NAMES.USERS);
            const data = sheet.getDataRange().getValues();
            const now = getCurrentTimestamp();
            for (let i = 1; i < data.length; i++) {
                if (data[i][0] === userId) {
                    sheet.getRange(i + 1, 7).setValue(false);
                    sheet.getRange(i + 1, 8).setValue(now);
                    sheet.getRange(i + 1, 10).setValue(now);
                    return this.findById(userId);
                }
            }
            return null;
        },

        countPending() {
            const sheet = SheetService.getSheet(SHEET_NAMES.USERS);
            const data = sheet.getDataRange().getValues();
            let count = 0;
            for (let i = 1; i < data.length; i++) {
                if (data[i][0] && !data[i][6] && !data[i][7]) count++;
            }
            return count;
        },

        mapToUser(row) {
            return { id: row[0], email: row[1], phone: row[2], password_hash: row[3], role: row[4], name: row[5], is_approved: row[6], rejected_at: row[7], created_at: row[8], updated_at: row[9] };
        }
    };
}

// ─── Test Setup ───────────────────────────────────────────────────────────────

const HEADERS = ['id', 'email', 'phone', 'password_hash', 'role', 'name', 'is_approved', 'rejected_at', 'created_at', 'updated_at'];
const SHEET_NAMES = { USERS: 'users' };

let UserRepository;
let idCounter = 1;

beforeEach(() => {
    idCounter = 1;
    const { SheetService } = createSheetDB({ users: HEADERS });
    UserRepository = buildUserRepository(
        SheetService, SHEET_NAMES,
        () => `u${idCounter++}`,
        () => '2024-01-01T00:00:00.000Z'
    );
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('UserRepository', () => {
    // ─── create ───────────────────────────────────────────────────────────────

    describe('create', () => {
        test('creates a user and returns it with generated id', () => {
            const user = UserRepository.create({ email: 'a@b.com', name: 'Alice', role: 'teacher', password_hash: 'hash1' });
            expect(user).not.toBeNull();
            expect(user.id).toBe('u1');
            expect(user.email).toBe('a@b.com');
            expect(user.role).toBe('teacher');
        });

        test('admin users are auto-approved', () => {
            const user = UserRepository.create({ email: 'admin@test.com', name: 'Admin', role: 'admin', password_hash: 'x' });
            expect(user.is_approved).toBe(true);
        });

        test('non-admin users are NOT auto-approved', () => {
            const user = UserRepository.create({ email: 't@t.com', name: 'T', role: 'teacher', password_hash: 'x' });
            expect(user.is_approved).toBe(false);
        });

        test('phone defaults to empty string when not provided', () => {
            const user = UserRepository.create({ email: 'x@x.com', name: 'X', role: 'student', password_hash: 'h' });
            expect(user.phone).toBe('');
        });
    });

    // ─── findByEmail ──────────────────────────────────────────────────────────

    describe('findByEmail', () => {
        test('returns user when email matches', () => {
            UserRepository.create({ email: 'find@b.com', name: 'Find', role: 'parent', password_hash: 'h' });
            const user = UserRepository.findByEmail('find@b.com');
            expect(user).not.toBeNull();
            expect(user.email).toBe('find@b.com');
        });

        test('returns null when email not found', () => {
            expect(UserRepository.findByEmail('missing@x.com')).toBeNull();
        });
    });

    // ─── findById ─────────────────────────────────────────────────────────────

    describe('findById', () => {
        test('returns user by id', () => {
            const created = UserRepository.create({ email: 'z@z.com', name: 'Z', role: 'student', password_hash: 'h' });
            expect(UserRepository.findById(created.id)).not.toBeNull();
        });

        test('returns null for non-existent id', () => {
            expect(UserRepository.findById('ghost')).toBeNull();
        });
    });

    // ─── findAll with pagination ──────────────────────────────────────────────

    describe('findAll', () => {
        beforeEach(() => {
            for (let i = 1; i <= 5; i++) {
                UserRepository.create({ email: `u${i}@x.com`, name: `User ${i}`, role: 'teacher', password_hash: 'h' });
            }
        });

        test('returns all users without limit', () => {
            const { users, pagination } = UserRepository.findAll();
            expect(users).toHaveLength(5);
            expect(pagination.total).toBe(5);
        });

        test('paginates with limit and offset', () => {
            const { users, pagination } = UserRepository.findAll({ limit: 2, offset: 1 });
            expect(users).toHaveLength(2);
            expect(pagination.has_more).toBe(true);
        });

        test('password_hash is NOT returned in findAll results', () => {
            const { users } = UserRepository.findAll();
            expect(users.every(u => u.password_hash === undefined)).toBe(true);
        });

        test('last page has has_more=false', () => {
            const { pagination } = UserRepository.findAll({ limit: 2, offset: 4 });
            expect(pagination.has_more).toBe(false);
        });
    });

    // ─── update ───────────────────────────────────────────────────────────────

    describe('update', () => {
        test('updates name and role', () => {
            const user = UserRepository.create({ email: 'e@e.com', name: 'Old', role: 'student', password_hash: 'h' });
            const updated = UserRepository.update(user.id, { name: 'New Name', role: 'teacher' });
            expect(updated.name).toBe('New Name');
            expect(updated.role).toBe('teacher');
        });

        test('returns null for non-existent user', () => {
            expect(UserRepository.update('ghost', { name: 'X' })).toBeNull();
        });

        test('partial update does not clear unspecified fields', () => {
            const user = UserRepository.create({ email: 'p@p.com', name: 'P', role: 'parent', phone: '111', password_hash: 'h' });
            const updated = UserRepository.update(user.id, { name: 'New P' });
            expect(updated.role).toBe('parent');
            expect(updated.phone).toBe('111');
        });
    });

    // ─── updateRole ───────────────────────────────────────────────────────────

    describe('updateRole', () => {
        test('changes user role and returns true', () => {
            const user = UserRepository.create({ email: 'r@r.com', name: 'R', role: 'student', password_hash: 'h' });
            expect(UserRepository.updateRole(user.id, 'teacher')).toBe(true);
            expect(UserRepository.findById(user.id).role).toBe('teacher');
        });

        test('returns false for non-existent user', () => {
            expect(UserRepository.updateRole('ghost', 'admin')).toBe(false);
        });
    });

    // ─── delete ───────────────────────────────────────────────────────────────

    describe('delete', () => {
        test('deletes user and returns true', () => {
            const user = UserRepository.create({ email: 'd@d.com', name: 'Del', role: 'student', password_hash: 'h' });
            expect(UserRepository.delete(user.id)).toBe(true);
            expect(UserRepository.findById(user.id)).toBeNull();
        });

        test('returns false for non-existent user', () => {
            expect(UserRepository.delete('ghost')).toBe(false);
        });
    });

    // ─── existsByEmail ────────────────────────────────────────────────────────

    describe('existsByEmail', () => {
        test('returns true if email exists', () => {
            UserRepository.create({ email: 'ex@x.com', name: 'Ex', role: 'student', password_hash: 'h' });
            expect(UserRepository.existsByEmail('ex@x.com')).toBe(true);
        });

        test('returns false if email does not exist', () => {
            expect(UserRepository.existsByEmail('nope@x.com')).toBe(false);
        });
    });

    // ─── approveUser / rejectUser ─────────────────────────────────────────────

    describe('approveUser', () => {
        test('sets is_approved=true and clears rejected_at', () => {
            const user = UserRepository.create({ email: 'ap@x.com', name: 'Ap', role: 'teacher', password_hash: 'h' });
            const approved = UserRepository.approveUser(user.id);
            expect(approved.is_approved).toBe(true);
            expect(approved.rejected_at).toBe('');
        });

        test('returns null for non-existent user', () => {
            expect(UserRepository.approveUser('ghost')).toBeNull();
        });
    });

    describe('rejectUser', () => {
        test('sets is_approved=false and records rejected_at', () => {
            const user = UserRepository.create({ email: 'rj@x.com', name: 'Rj', role: 'teacher', password_hash: 'h' });
            const rejected = UserRepository.rejectUser(user.id);
            expect(rejected.is_approved).toBe(false);
            expect(rejected.rejected_at).toBeTruthy();
        });

        test('returns null for non-existent user', () => {
            expect(UserRepository.rejectUser('ghost')).toBeNull();
        });
    });

    // ─── findPending / countPending ───────────────────────────────────────────

    describe('findPending', () => {
        test('returns only unapproved, non-rejected users', () => {
            UserRepository.create({ email: 'p1@x.com', name: 'P1', role: 'teacher', password_hash: 'h' }); // pending
            UserRepository.create({ email: 'p2@x.com', name: 'P2', role: 'admin', password_hash: 'h' });   // auto-approved
            const { users } = UserRepository.findPending();
            expect(users).toHaveLength(1);
            expect(users[0].email).toBe('p1@x.com');
        });

        test('filters by role', () => {
            UserRepository.create({ email: 'pt@x.com', name: 'PT', role: 'teacher', password_hash: 'h' });
            UserRepository.create({ email: 'pp@x.com', name: 'PP', role: 'parent', password_hash: 'h' });
            const { users } = UserRepository.findPending({ role: 'teacher' });
            expect(users).toHaveLength(1);
            expect(users[0].role).toBe('teacher');
        });
    });

    describe('countPending', () => {
        test('counts unapproved non-rejected users', () => {
            UserRepository.create({ email: 'c1@x.com', name: 'C1', role: 'teacher', password_hash: 'h' });
            UserRepository.create({ email: 'c2@x.com', name: 'C2', role: 'teacher', password_hash: 'h' });
            UserRepository.create({ email: 'c3@x.com', name: 'C3', role: 'admin', password_hash: 'h' }); // approved
            expect(UserRepository.countPending()).toBe(2);
        });

        test('returns 0 when all are approved', () => {
            UserRepository.create({ email: 'a@x.com', name: 'A', role: 'admin', password_hash: 'h' });
            expect(UserRepository.countPending()).toBe(0);
        });
    });
});
