/**
 * School, Class, Section Repository CRUD Tests
 * 
 * All three share identical CRUD patterns (findAll, findById, create, update, delete)
 * with filtering by foreign key (school_id, class_id).
 */

const { createSheetDB } = require('../../mocks/SheetService.mock');

// ─── Generic CRUD Factory ─────────────────────────────────────────────────────
// Builds an in-memory version of any "simple" repository that follows the pattern:
//   rows: [id, ...fields], headers matching field names

function buildGenericRepo(SheetService, sheetKey, SHEET_NAMES, generateId, idField = 'id') {
    return {
        findAll(options = {}) {
            const sheet = SheetService.getSheet(SHEET_NAMES[sheetKey]);
            const data = sheet.getDataRange().getValues();
            const headers = data[0];
            let items = data.slice(1).map(row => {
                const obj = {};
                headers.forEach((h, i) => obj[h] = row[i]);
                return obj;
            }).filter(r => r[idField] && r.name !== undefined ? r.name !== undefined : true);

            // Apply filters passed as options (school_id, class_id, etc.)
            Object.keys(options).forEach(key => {
                if (key !== 'limit' && key !== 'offset' && options[key] !== undefined) {
                    items = items.filter(i => String(i[key]) === String(options[key]));
                }
            });

            const total = items.length;
            if (options.limit > 0) {
                items = items.slice(options.offset || 0, (options.offset || 0) + options.limit);
            }
            return { items, total };
        },

        findById(id) {
            const sheet = SheetService.getSheet(SHEET_NAMES[sheetKey]);
            const data = sheet.getDataRange().getValues();
            const headers = data[0];
            for (let i = 1; i < data.length; i++) {
                if (data[i][0] === id) {
                    const obj = {};
                    headers.forEach((h, j) => obj[h] = data[i][j]);
                    return obj;
                }
            }
            return null;
        },

        create(itemData) {
            const sheet = SheetService.getSheet(SHEET_NAMES[sheetKey]);
            const id = generateId();
            const now = new Date().toISOString();
            const headers = sheet.getDataRange().getValues()[0];
            const row = headers.map(h => {
                if (h === 'id') return id;
                if (h === 'created_at' || h === 'updated_at') return now;
                return itemData[h] !== undefined ? itemData[h] : '';
            });
            sheet.appendRow(row);
            return this.findById(id);
        },

        update(id, itemData) {
            const sheet = SheetService.getSheet(SHEET_NAMES[sheetKey]);
            const dataRange = sheet.getDataRange();
            const values = dataRange.getValues();
            const headers = values[0];
            for (let i = 1; i < values.length; i++) {
                if (values[i][0] === id) {
                    headers.forEach((h, colIdx) => {
                        if (itemData[h] !== undefined) values[i][colIdx] = itemData[h];
                    });
                    dataRange.setValues(values);
                    return this.findById(id);
                }
            }
            return null;
        },

        delete(id) {
            const sheet = SheetService.getSheet(SHEET_NAMES[sheetKey]);
            const data = sheet.getDataRange().getValues();
            for (let i = 1; i < data.length; i++) {
                if (data[i][0] === id) { sheet.deleteRow(i + 1); return true; }
            }
            return false;
        }
    };
}

// ─── SchoolRepository Tests ───────────────────────────────────────────────────

describe('SchoolRepository', () => {
    const SCHOOL_HEADERS = ['id', 'name', 'address', 'phone', 'email', 'created_at'];
    const SHEET_NAMES = { SCHOOLS: 'schools' };
    let Repo;
    let counter;

    beforeEach(() => {
        counter = 1;
        const { SheetService } = createSheetDB({ schools: SCHOOL_HEADERS });
        Repo = buildGenericRepo(SheetService, 'SCHOOLS', SHEET_NAMES, () => `sc${counter++}`);
    });

    test('create returns school with generated id', () => {
        const school = Repo.create({ name: 'Green Valley', address: '123 Main St', phone: '0000000000', email: 'gv@school.com' });
        expect(school.id).toBe('sc1');
        expect(school.name).toBe('Green Valley');
    });

    test('findById retrieves created school', () => {
        const s = Repo.create({ name: 'S1' });
        expect(Repo.findById(s.id).name).toBe('S1');
    });

    test('findById returns null for unknown id', () => {
        expect(Repo.findById('ghost')).toBeNull();
    });

    test('findAll returns all schools', () => {
        Repo.create({ name: 'S1' });
        Repo.create({ name: 'S2' });
        const { items, total } = Repo.findAll();
        expect(total).toBe(2);
        expect(items).toHaveLength(2);
    });

    test('update modifies school fields', () => {
        const s = Repo.create({ name: 'Old Name' });
        const updated = Repo.update(s.id, { name: 'New Name', address: 'Updated' });
        expect(updated.name).toBe('New Name');
        expect(updated.address).toBe('Updated');
    });

    test('update returns null for missing school', () => {
        expect(Repo.update('ghost', { name: 'X' })).toBeNull();
    });

    test('delete removes school and returns true', () => {
        const s = Repo.create({ name: 'Del School' });
        expect(Repo.delete(s.id)).toBe(true);
        expect(Repo.findById(s.id)).toBeNull();
    });

    test('delete returns false for non-existent id', () => {
        expect(Repo.delete('ghost')).toBe(false);
    });
});

// ─── ClassRepository Tests ────────────────────────────────────────────────────

describe('ClassRepository', () => {
    const CLASS_HEADERS = ['id', 'school_id', 'name', 'stream', 'academic_year', 'is_active', 'created_at'];
    const SHEET_NAMES = { CLASSES: 'classes' };
    let Repo;
    let counter;

    beforeEach(() => {
        counter = 1;
        const { SheetService } = createSheetDB({ classes: CLASS_HEADERS });
        Repo = buildGenericRepo(SheetService, 'CLASSES', SHEET_NAMES, () => `cl${counter++}`);
    });

    test('create class with school_id and academic_year', () => {
        const cls = Repo.create({ school_id: 'sch1', name: 'Grade 5', stream: 'Science', academic_year: '2025', is_active: true });
        expect(cls.id).toBe('cl1');
        expect(cls.school_id).toBe('sch1');
        expect(cls.academic_year).toBe('2025');
    });

    test('findAll returns only classes for given school_id', () => {
        Repo.create({ school_id: 'sch1', name: 'G5' });
        Repo.create({ school_id: 'sch1', name: 'G6' });
        Repo.create({ school_id: 'sch2', name: 'G7' });
        const { items } = Repo.findAll({ school_id: 'sch1' });
        expect(items).toHaveLength(2);
        expect(items.every(c => c.school_id === 'sch1')).toBe(true);
    });

    test('paginated findAll respects limit and offset', () => {
        for (let i = 1; i <= 5; i++) Repo.create({ school_id: 'sch1', name: `G${i}` });
        const { items, total } = Repo.findAll({ limit: 2, offset: 2 });
        expect(total).toBe(5);
        expect(items).toHaveLength(2);
    });

    test('update class name and is_active', () => {
        const cls = Repo.create({ school_id: 's1', name: 'Old', is_active: true });
        const updated = Repo.update(cls.id, { name: 'New', is_active: false });
        expect(updated.name).toBe('New');
        expect(updated.is_active).toBe(false);
    });

    test('delete class returns true', () => {
        const cls = Repo.create({ school_id: 's1', name: 'Del' });
        expect(Repo.delete(cls.id)).toBe(true);
        expect(Repo.findById(cls.id)).toBeNull();
    });
});

// ─── SectionRepository Tests ──────────────────────────────────────────────────

describe('SectionRepository', () => {
    const SEC_HEADERS = ['id', 'class_id', 'name', 'capacity', 'created_at'];
    const SHEET_NAMES = { SECTIONS: 'sections' };
    let Repo;
    let counter;

    beforeEach(() => {
        counter = 1;
        const { SheetService } = createSheetDB({ sections: SEC_HEADERS });
        Repo = buildGenericRepo(SheetService, 'SECTIONS', SHEET_NAMES, () => `sec${counter++}`);
    });

    test('create section linked to class', () => {
        const sec = Repo.create({ class_id: 'cl1', name: 'A', capacity: 30 });
        expect(sec.class_id).toBe('cl1');
        expect(sec.name).toBe('A');
        expect(sec.capacity).toBe(30);
    });

    test('findAll filtered by class_id', () => {
        Repo.create({ class_id: 'cl1', name: 'A' });
        Repo.create({ class_id: 'cl1', name: 'B' });
        Repo.create({ class_id: 'cl2', name: 'C' });
        const { items } = Repo.findAll({ class_id: 'cl1' });
        expect(items).toHaveLength(2);
    });

    test('delete section', () => {
        const sec = Repo.create({ class_id: 'cl1', name: 'X' });
        expect(Repo.delete(sec.id)).toBe(true);
        expect(Repo.findById(sec.id)).toBeNull();
    });

    test('update section capacity', () => {
        const sec = Repo.create({ class_id: 'cl1', name: 'A', capacity: 20 });
        const updated = Repo.update(sec.id, { capacity: 35 });
        expect(updated.capacity).toBe(35);
    });
});
