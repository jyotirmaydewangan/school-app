/**
 * Student, Role, Attendance, Exam, Timetable, Curriculum Repository CRUD Tests
 * 
 * All repositories follow the same Google Sheets in-memory pattern.
 */

const { createSheetDB } = require('../../mocks/SheetService.mock');

// ─── Shared Generic Repo Builder ──────────────────────────────────────────────
function buildRepo(SheetService, sheetName, sheet_db_key, generateId) {
    const getSheet = () => SheetService.getSheet(sheet_db_key);

    return {
        findAll(filterFn = null) {
            const data = getSheet().getDataRange().getValues();
            const headers = data[0];
            let items = data.slice(1).map(row => {
                const obj = {};
                headers.forEach((h, i) => obj[h] = row[i]);
                return obj;
            }).filter(r => r.id);
            if (filterFn) items = items.filter(filterFn);
            return items;
        },

        findById(id) {
            const data = getSheet().getDataRange().getValues();
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
            const sheet = getSheet();
            const id = generateId();
            const headers = sheet.getDataRange().getValues()[0];
            const row = headers.map(h => {
                if (h === 'id') return id;
                if (h === 'created_at') return new Date().toISOString();
                return itemData[h] !== undefined ? itemData[h] : '';
            });
            sheet.appendRow(row);
            return this.findById(id);
        },

        update(id, updates) {
            const sheet = getSheet();
            const dataRange = sheet.getDataRange();
            const values = dataRange.getValues();
            const headers = values[0];
            for (let i = 1; i < values.length; i++) {
                if (values[i][0] === id) {
                    headers.forEach((h, colIdx) => {
                        if (updates[h] !== undefined) values[i][colIdx] = updates[h];
                    });
                    dataRange.setValues(values);
                    return this.findById(id);
                }
            }
            return null;
        },

        delete(id) {
            const sheet = getSheet();
            const data = sheet.getDataRange().getValues();
            for (let i = 1; i < data.length; i++) {
                if (data[i][0] === id) { sheet.deleteRow(i + 1); return true; }
            }
            return false;
        }
    };
}

let counter = 1;
const nextId = () => `id${counter++}`;
beforeEach(() => { counter = 1; });

// ─── StudentRepository Tests ──────────────────────────────────────────────────

describe('StudentRepository', () => {
    const HEADERS = ['id', 'name', 'admission_no', 'class_id', 'section_id', 'status', 'parent_phone1', 'parent_phone2', 'created_at'];
    let Repo;
    let DB;

    beforeEach(() => {
        const { SheetService } = createSheetDB({ students: HEADERS });
        DB = SheetService;
        Repo = buildRepo(SheetService, 'students', 'students', nextId);
    });

    test('create student with required fields', () => {
        const s = Repo.create({ name: 'Alice', admission_no: 'S001', class_id: 'c1', section_id: 'sec1', status: 'pending' });
        expect(s.id).toBeDefined();
        expect(s.name).toBe('Alice');
        expect(s.admission_no).toBe('S001');
        expect(s.status).toBe('pending');
    });

    test('findAll returns all students', () => {
        Repo.create({ name: 'Alice', admission_no: 'S001' });
        Repo.create({ name: 'Bob', admission_no: 'S002' });
        const all = Repo.findAll();
        expect(all).toHaveLength(2);
    });

    test('findAll with filter by class_id', () => {
        Repo.create({ name: 'Alice', class_id: 'c1', status: 'approved' });
        Repo.create({ name: 'Bob', class_id: 'c2', status: 'approved' });
        Repo.create({ name: 'Carol', class_id: 'c1', status: 'pending' });
        const filtered = Repo.findAll(s => s.class_id === 'c1');
        expect(filtered).toHaveLength(2);
    });

    test('findAll with filter by status=pending', () => {
        Repo.create({ name: 'A', class_id: 'c1', status: 'pending' });
        Repo.create({ name: 'B', class_id: 'c1', status: 'approved' });
        const pending = Repo.findAll(s => s.status === 'pending');
        expect(pending).toHaveLength(1);
        expect(pending[0].name).toBe('A');
    });

    test('findById returns correct student', () => {
        const s = Repo.create({ name: 'Dave', admission_no: 'S003' });
        const found = Repo.findById(s.id);
        expect(found).not.toBeNull();
        expect(found.name).toBe('Dave');
    });

    test('findById returns null for unknown id', () => {
        expect(Repo.findById('ghost')).toBeNull();
    });

    test('update student status → approved', () => {
        const s = Repo.create({ name: 'E', status: 'pending' });
        const updated = Repo.update(s.id, { status: 'approved' });
        expect(updated.status).toBe('approved');
    });

    test('update student class_id and section_id', () => {
        const s = Repo.create({ name: 'F', class_id: 'c1', section_id: 'sec1' });
        const updated = Repo.update(s.id, { class_id: 'c2', section_id: 'sec2' });
        expect(updated.class_id).toBe('c2');
        expect(updated.section_id).toBe('sec2');
    });

    test('delete student returns true and removes from store', () => {
        const s = Repo.create({ name: 'G', admission_no: 'S004' });
        expect(Repo.delete(s.id)).toBe(true);
        expect(Repo.findById(s.id)).toBeNull();
    });

    test('delete non-existent student returns false', () => {
        expect(Repo.delete('ghost')).toBe(false);
    });
});

// ─── RoleRepository Tests ─────────────────────────────────────────────────────

describe('RoleRepository', () => {
    const HEADERS = ['id', 'name', 'permissions', 'is_active', 'created_at'];
    let Repo;

    beforeEach(() => {
        const { SheetService } = createSheetDB({ roles: HEADERS });
        Repo = buildRepo(SheetService, 'roles', 'roles', nextId);
    });

    test('create role with name and permissions JSON', () => {
        const role = Repo.create({ name: 'teacher', permissions: JSON.stringify(['read:students', 'write:grades']), is_active: true });
        expect(role.name).toBe('teacher');
        const perms = JSON.parse(role.permissions);
        expect(perms).toContain('read:students');
    });

    test('findAll returns all roles', () => {
        Repo.create({ name: 'admin', permissions: '["*"]', is_active: true });
        Repo.create({ name: 'parent', permissions: '["read:own_child"]', is_active: true });
        expect(Repo.findAll()).toHaveLength(2);
    });

    test('findById returns correct role', () => {
        const role = Repo.create({ name: 'student', permissions: '[]', is_active: true });
        expect(Repo.findById(role.id).name).toBe('student');
    });

    test('update role permissions', () => {
        const role = Repo.create({ name: 'editor', permissions: '[]', is_active: true });
        const updated = Repo.update(role.id, { permissions: '["read:all"]' });
        expect(JSON.parse(updated.permissions)).toContain('read:all');
    });

    test('deactivate role', () => {
        const role = Repo.create({ name: 'viewer', permissions: '[]', is_active: true });
        const updated = Repo.update(role.id, { is_active: false });
        expect(updated.is_active).toBe(false);
    });

    test('delete role', () => {
        const role = Repo.create({ name: 'del_role', permissions: '[]', is_active: true });
        expect(Repo.delete(role.id)).toBe(true);
        expect(Repo.findById(role.id)).toBeNull();
    });
});

// ─── AttendanceRepository Tests ───────────────────────────────────────────────

describe('AttendanceRepository', () => {
    const HEADERS = ['id', 'student_id', 'class_id', 'date', 'status', 'marked_by', 'created_at'];
    let Repo;

    beforeEach(() => {
        const { SheetService } = createSheetDB({ attendance: HEADERS });
        Repo = buildRepo(SheetService, 'attendance', 'attendance', nextId);
    });

    test('create attendance record', () => {
        const rec = Repo.create({ student_id: 's1', class_id: 'c1', date: '2025-01-15', status: 'present', marked_by: 'teacher1' });
        expect(rec.student_id).toBe('s1');
        expect(rec.status).toBe('present');
        expect(rec.date).toBe('2025-01-15');
    });

    test('findAll filtered by class and date', () => {
        Repo.create({ student_id: 's1', class_id: 'c1', date: '2025-01-15', status: 'present' });
        Repo.create({ student_id: 's2', class_id: 'c1', date: '2025-01-15', status: 'absent' });
        Repo.create({ student_id: 's3', class_id: 'c2', date: '2025-01-15', status: 'present' });

        const forClass = Repo.findAll(r => r.class_id === 'c1' && r.date === '2025-01-15');
        expect(forClass).toHaveLength(2);
    });

    test('findAll absent students for a date', () => {
        Repo.create({ student_id: 's1', class_id: 'c1', date: '2025-01-15', status: 'absent' });
        Repo.create({ student_id: 's2', class_id: 'c1', date: '2025-01-15', status: 'present' });
        const absent = Repo.findAll(r => r.status === 'absent');
        expect(absent).toHaveLength(1);
        expect(absent[0].student_id).toBe('s1');
    });

    test('update attendance status (correction)', () => {
        const rec = Repo.create({ student_id: 's1', class_id: 'c1', date: '2025-01-15', status: 'absent' });
        const updated = Repo.update(rec.id, { status: 'present' });
        expect(updated.status).toBe('present');
    });

    test('delete attendance record', () => {
        const rec = Repo.create({ student_id: 's1', class_id: 'c1', date: '2025-01-15', status: 'present' });
        expect(Repo.delete(rec.id)).toBe(true);
        expect(Repo.findById(rec.id)).toBeNull();
    });

    test('attendance returns empty array when no records', () => {
        expect(Repo.findAll()).toHaveLength(0);
    });
});

// ─── ExamRepository Tests ────────────────────────────────────────────────────

describe('ExamRepository', () => {
    const EXAM_HEADERS = ['id', 'name', 'class_id', 'subject_id', 'date', 'max_marks', 'created_at'];
    const MARKS_HEADERS = ['id', 'exam_id', 'student_id', 'marks', 'grade', 'remarks', 'created_at'];
    let ExamRepo;
    let MarksRepo;

    beforeEach(() => {
        const { SheetService } = createSheetDB({ exams: EXAM_HEADERS, marks: MARKS_HEADERS });
        ExamRepo = buildRepo(SheetService, 'exams', 'exams', nextId);
        MarksRepo = buildRepo(SheetService, 'marks', 'marks', nextId);
    });

    describe('Exam CRUD', () => {
        test('create exam', () => {
            const e = ExamRepo.create({ name: 'Midterm', class_id: 'c1', subject_id: 'sub1', date: '2025-03-01', max_marks: 100 });
            expect(e.name).toBe('Midterm');
            expect(e.max_marks).toBe(100);
        });

        test('findAll exams for class', () => {
            ExamRepo.create({ name: 'Midterm', class_id: 'c1', subject_id: 'sub1' });
            ExamRepo.create({ name: 'Final', class_id: 'c1', subject_id: 'sub2' });
            ExamRepo.create({ name: 'Quiz', class_id: 'c2', subject_id: 'sub1' });
            const classExams = ExamRepo.findAll(e => e.class_id === 'c1');
            expect(classExams).toHaveLength(2);
        });

        test('update exam date and max_marks', () => {
            const e = ExamRepo.create({ name: 'Test', class_id: 'c1', date: '2025-01-01', max_marks: 50 });
            const updated = ExamRepo.update(e.id, { date: '2025-02-01', max_marks: 75 });
            expect(updated.date).toBe('2025-02-01');
            expect(updated.max_marks).toBe(75);
        });

        test('delete exam', () => {
            const e = ExamRepo.create({ name: 'Del', class_id: 'c1' });
            expect(ExamRepo.delete(e.id)).toBe(true);
            expect(ExamRepo.findById(e.id)).toBeNull();
        });
    });

    describe('Marks CRUD', () => {
        test('enter marks for a student', () => {
            const exam = ExamRepo.create({ name: 'Midterm', class_id: 'c1', max_marks: 100 });
            const marks = MarksRepo.create({ exam_id: exam.id, student_id: 's1', marks: 85, grade: 'A', remarks: 'Good' });
            expect(marks.marks).toBe(85);
            expect(marks.grade).toBe('A');
        });

        test('findAll marks for an exam', () => {
            const exam = ExamRepo.create({ name: 'Final', class_id: 'c1' });
            MarksRepo.create({ exam_id: exam.id, student_id: 's1', marks: 90 });
            MarksRepo.create({ exam_id: exam.id, student_id: 's2', marks: 75 });
            const examMarks = MarksRepo.findAll(m => m.exam_id === exam.id);
            expect(examMarks).toHaveLength(2);
        });

        test('update marks (re-grading)', () => {
            const exam = ExamRepo.create({ name: 'Quiz', class_id: 'c1' });
            const marks = MarksRepo.create({ exam_id: exam.id, student_id: 's1', marks: 60, grade: 'C' });
            const updated = MarksRepo.update(marks.id, { marks: 80, grade: 'B' });
            expect(updated.marks).toBe(80);
            expect(updated.grade).toBe('B');
        });

        test('delete marks entry', () => {
            const exam = ExamRepo.create({ name: 'X', class_id: 'c1' });
            const marks = MarksRepo.create({ exam_id: exam.id, student_id: 's1', marks: 50 });
            expect(MarksRepo.delete(marks.id)).toBe(true);
        });

        test('student with 0 marks is distinct from missing record', () => {
            const exam = ExamRepo.create({ name: 'Y', class_id: 'c1' });
            const m = MarksRepo.create({ exam_id: exam.id, student_id: 's1', marks: 0 });
            expect(m.marks).toBe(0);
            // Absent student (no record)
            expect(MarksRepo.findById('ghost')).toBeNull();
        });
    });
});

// ─── TimetableRepository Tests ────────────────────────────────────────────────

describe('TimetableRepository', () => {
    const HEADERS = ['id', 'class_id', 'section_id', 'subject_id', 'day', 'start_time', 'end_time', 'teacher_id', 'created_at'];
    let Repo;

    beforeEach(() => {
        const { SheetService } = createSheetDB({ timetable: HEADERS });
        Repo = buildRepo(SheetService, 'timetable', 'timetable', nextId);
    });

    test('create timetable entry', () => {
        const entry = Repo.create({ class_id: 'c1', section_id: 'sec1', subject_id: 'sub1', day: 'Monday', start_time: '09:00', end_time: '10:00', teacher_id: 't1' });
        expect(entry.day).toBe('Monday');
        expect(entry.subject_id).toBe('sub1');
    });

    test('findAll timetable for a class', () => {
        Repo.create({ class_id: 'c1', day: 'Monday', subject_id: 'sub1' });
        Repo.create({ class_id: 'c1', day: 'Tuesday', subject_id: 'sub2' });
        Repo.create({ class_id: 'c2', day: 'Monday', subject_id: 'sub1' });
        const classSchedule = Repo.findAll(e => e.class_id === 'c1');
        expect(classSchedule).toHaveLength(2);
    });

    test('findAll by day', () => {
        Repo.create({ class_id: 'c1', day: 'Monday' });
        Repo.create({ class_id: 'c1', day: 'Tuesday' });
        const mondays = Repo.findAll(e => e.day === 'Monday');
        expect(mondays).toHaveLength(1);
    });

    test('update timetable teacher assignment', () => {
        const e = Repo.create({ class_id: 'c1', day: 'Monday', teacher_id: 't1' });
        const updated = Repo.update(e.id, { teacher_id: 't2' });
        expect(updated.teacher_id).toBe('t2');
    });

    test('delete timetable entry', () => {
        const e = Repo.create({ class_id: 'c1', day: 'Friday' });
        expect(Repo.delete(e.id)).toBe(true);
        expect(Repo.findById(e.id)).toBeNull();
    });
});

// ─── CurriculumRepository Tests ───────────────────────────────────────────────

describe('CurriculumRepository (Subject + Syllabus + Resources)', () => {
    const SUBJECT_HEADERS = ['id', 'name', 'class_id', 'teacher_id', 'created_at'];
    const SYLLABUS_HEADERS = ['id', 'subject_id', 'topic', 'description', 'order', 'status', 'created_at'];
    const RESOURCE_HEADERS = ['id', 'subject_id', 'title', 'url', 'type', 'uploaded_by', 'created_at'];
    let SubjectRepo;
    let SyllabusRepo;
    let ResourceRepo;

    beforeEach(() => {
        const { SheetService } = createSheetDB({
            subjects: SUBJECT_HEADERS,
            syllabus: SYLLABUS_HEADERS,
            resources: RESOURCE_HEADERS
        });
        SubjectRepo = buildRepo(SheetService, 'subjects', 'subjects', nextId);
        SyllabusRepo = buildRepo(SheetService, 'syllabus', 'syllabus', nextId);
        ResourceRepo = buildRepo(SheetService, 'resources', 'resources', nextId);
    });

    describe('Subject CRUD', () => {
        test('create subject for a class', () => {
            const sub = SubjectRepo.create({ name: 'Mathematics', class_id: 'c1', teacher_id: 't1' });
            expect(sub.name).toBe('Mathematics');
            expect(sub.class_id).toBe('c1');
        });

        test('findAll subjects for class', () => {
            SubjectRepo.create({ name: 'Math', class_id: 'c1', teacher_id: 't1' });
            SubjectRepo.create({ name: 'Science', class_id: 'c1', teacher_id: 't2' });
            SubjectRepo.create({ name: 'History', class_id: 'c2', teacher_id: 't1' });
            const subs = SubjectRepo.findAll(s => s.class_id === 'c1');
            expect(subs).toHaveLength(2);
        });

        test('update subject teacher', () => {
            const sub = SubjectRepo.create({ name: 'Physics', class_id: 'c1', teacher_id: 't1' });
            const updated = SubjectRepo.update(sub.id, { teacher_id: 't3' });
            expect(updated.teacher_id).toBe('t3');
        });

        test('delete subject', () => {
            const sub = SubjectRepo.create({ name: 'Chemistry', class_id: 'c1' });
            expect(SubjectRepo.delete(sub.id)).toBe(true);
            expect(SubjectRepo.findById(sub.id)).toBeNull();
        });
    });

    describe('Syllabus CRUD', () => {
        test('add syllabus topic to a subject', () => {
            const sub = SubjectRepo.create({ name: 'Math', class_id: 'c1' });
            const topic = SyllabusRepo.create({ subject_id: sub.id, topic: 'Algebra Basics', order: 1, status: 'pending' });
            expect(topic.topic).toBe('Algebra Basics');
            expect(topic.subject_id).toBe(sub.id);
        });

        test('findAll syllabus topics for subject', () => {
            const sub1 = SubjectRepo.create({ name: 'M', class_id: 'c1' });
            const sub2 = SubjectRepo.create({ name: 'S', class_id: 'c1' });
            SyllabusRepo.create({ subject_id: sub1.id, topic: 'T1' });
            SyllabusRepo.create({ subject_id: sub1.id, topic: 'T2' });
            SyllabusRepo.create({ subject_id: sub2.id, topic: 'T3' });
            const topics = SyllabusRepo.findAll(t => t.subject_id === sub1.id);
            expect(topics).toHaveLength(2);
        });

        test('update syllabus topic status to completed', () => {
            const sub = SubjectRepo.create({ name: 'M', class_id: 'c1' });
            const topic = SyllabusRepo.create({ subject_id: sub.id, topic: 'Algebra', status: 'pending' });
            const updated = SyllabusRepo.update(topic.id, { status: 'completed' });
            expect(updated.status).toBe('completed');
        });

        test('delete syllabus topic', () => {
            const sub = SubjectRepo.create({ name: 'M', class_id: 'c1' });
            const topic = SyllabusRepo.create({ subject_id: sub.id, topic: 'X' });
            expect(SyllabusRepo.delete(topic.id)).toBe(true);
        });
    });

    describe('Resource CRUD', () => {
        test('add resource (PDF link) to a subject', () => {
            const sub = SubjectRepo.create({ name: 'Science', class_id: 'c1' });
            const res = ResourceRepo.create({ subject_id: sub.id, title: 'Chapter 1 PDF', url: 'https://drive.google.com/...', type: 'pdf', uploaded_by: 't1' });
            expect(res.title).toBe('Chapter 1 PDF');
            expect(res.type).toBe('pdf');
        });

        test('findAll resources filtered by subject', () => {
            const sub = SubjectRepo.create({ name: 'Art', class_id: 'c1' });
            ResourceRepo.create({ subject_id: sub.id, title: 'Video 1', type: 'video' });
            ResourceRepo.create({ subject_id: sub.id, title: 'Doc 1', type: 'pdf' });
            const res = ResourceRepo.findAll(r => r.subject_id === sub.id);
            expect(res).toHaveLength(2);
        });

        test('findAll resources by type', () => {
            const sub = SubjectRepo.create({ name: 'PE', class_id: 'c1' });
            ResourceRepo.create({ subject_id: sub.id, title: 'V1', type: 'video' });
            ResourceRepo.create({ subject_id: sub.id, title: 'P1', type: 'pdf' });
            const videos = ResourceRepo.findAll(r => r.type === 'video');
            expect(videos).toHaveLength(1);
        });

        test('delete resource', () => {
            const sub = SubjectRepo.create({ name: 'M', class_id: 'c1' });
            const res = ResourceRepo.create({ subject_id: sub.id, title: 'Del', type: 'pdf' });
            expect(ResourceRepo.delete(res.id)).toBe(true);
            expect(ResourceRepo.findById(res.id)).toBeNull();
        });
    });
});
