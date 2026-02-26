const ExamRepository = {
  findAll(options = {}) {
    const sheet = SheetService.getSheet(SHEET_NAMES.EXAMS);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    let exams = data.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = row[i]);
      return obj;
    }).filter(e => e.id && e.name);
    
    if (options.class) {
      exams = exams.filter(e => String(e.class) === String(options.class));
    }
    
    if (options.subject_id) {
      exams = exams.filter(e => e.subject_id === options.subject_id);
    }
    
    if (options.date) {
      exams = exams.filter(e => e.date === options.date);
    }
    
    return exams;
  },

  findById(id) {
    const sheet = SheetService.getSheet(SHEET_NAMES.EXAMS);
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

  create(data) {
    const sheet = SheetService.getSheet(SHEET_NAMES.EXAMS);
    const id = Utilities.getUuid();
    const now = new Date().toISOString();
    
    const row = [
      id,
      data.name,
      data.class,
      data.section || '',
      data.subject_id,
      data.date,
      data.max_marks || 100,
      now
    ];
    
    sheet.appendRow(row);
    SpreadsheetApp.flush();
    
    return { id, ...data, max_marks: data.max_marks || 100, created_at: now };
  },

  update(id, data) {
    const sheet = SheetService.getSheet(SHEET_NAMES.EXAMS);
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    const headers = values[0];
    
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === id) {
        ['name', 'class', 'section', 'subject_id', 'date', 'max_marks'].forEach(field => {
          const colIndex = headers.indexOf(field);
          if (colIndex !== -1 && data[field] !== undefined) {
            values[i][colIndex] = data[field];
          }
        });
        
        dataRange.setValues(values);
        SpreadsheetApp.flush();
        
        return this.findById(id);
      }
    }
    return null;
  },

  delete(id) {
    const sheet = SheetService.getSheet(SHEET_NAMES.EXAMS);
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === id) {
        MarksRepository.deleteByExamId(id);
        
        sheet.deleteRow(i + 1);
        SpreadsheetApp.flush();
        return { success: true };
      }
    }
    return { success: false, error: 'Exam not found' };
  }
};

const MarksRepository = {
  findAll(options = {}) {
    const sheet = SheetService.getSheet(SHEET_NAMES.MARKS);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    let marks = data.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = row[i]);
      return obj;
    }).filter(m => m.id);
    
    if (options.exam_id) {
      marks = marks.filter(m => m.exam_id === options.exam_id);
    }
    
    if (options.student_id) {
      marks = marks.filter(m => m.student_id === options.student_id);
    }
    
    return marks;
  },

  findById(id) {
    const sheet = SheetService.getSheet(SHEET_NAMES.MARKS);
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

  findByExamAndStudent(examId, studentId) {
    const sheet = SheetService.getSheet(SHEET_NAMES.MARKS);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === examId && data[i][2] === studentId) {
        const obj = {};
        headers.forEach((h, j) => obj[h] = data[i][j]);
        return obj;
      }
    }
    return null;
  },

  enterMarks(examId, marksData) {
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    
    try {
      const sheet = SheetService.getSheet(SHEET_NAMES.MARKS);
      const results = { success: 0, failed: 0 };
      
      const records = marksData.records || [];
      
      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        
        const existing = this.findByExamAndStudent(examId, record.student_id);
        
        if (existing) {
          const dataRange = sheet.getDataRange();
          const values = dataRange.getValues();
          const headers = values[0];
          
          for (let j = 1; j < values.length; j++) {
            if (values[j][0] === existing.id) {
              values[j][3] = record.marks_obtained;
              values[j][4] = new Date().toISOString();
              dataRange.setValues(values);
              break;
            }
          }
        } else {
          const id = Utilities.getUuid();
          const now = new Date().toISOString();
          
          sheet.appendRow([id, examId, record.student_id, record.marks_obtained, now]);
          results.success++;
        }
      }
      
      SpreadsheetApp.flush();
      return results;
    } finally {
      lock.releaseLock();
    }
  },

  getByExam(examId) {
    const marks = this.findAll({ exam_id: examId });
    const exam = ExamRepository.findById(examId);
    
    return marks.map(m => {
      const student = StudentRepository.findById(m.student_id);
      return {
        ...m,
        student_name: student ? student.name : 'Unknown',
        admission_no: student ? student.admission_no : '',
        max_marks: exam ? exam.max_marks : 100,
        percentage: exam ? (m.marks_obtained / exam.max_marks * 100).toFixed(2) : 0
      };
    });
  },

  getByStudent(studentId, options = {}) {
    const marks = this.findAll({ student_id: studentId });
    
    return marks.map(m => {
      const exam = ExamRepository.findById(m.exam_id);
      const subject = exam ? SubjectRepository.findById(exam.subject_id) : null;
      
      return {
        ...m,
        exam_name: exam ? exam.name : 'Unknown',
        subject_name: subject ? subject.name : 'Unknown',
        max_marks: exam ? exam.max_marks : 100,
        percentage: exam ? (m.marks_obtained / exam.max_marks * 100).toFixed(2) : 0
      };
    });
  },

  calculateGrades(studentId, examIds = []) {
    let exams = examIds.length > 0 
      ? examIds.map(id => ExamRepository.findById(id)).filter(e => e)
      : ExamRepository.findAll();
    
    const marks = this.getByStudent(studentId);
    const marksMap = {};
    marks.forEach(m => marksMap[m.exam_id] = m);
    
    let totalMarks = 0;
    let totalMaxMarks = 0;
    let subjectGrades = [];
    
    exams.forEach(exam => {
      const mark = marksMap[exam.id];
      if (mark) {
        totalMarks += parseFloat(mark.marks_obtained);
        totalMaxMarks += parseFloat(exam.max_marks);
        
        const subject = SubjectRepository.findById(exam.subject_id);
        subjectGrades.push({
          subject: subject ? subject.name : 'Unknown',
          marks: mark.marks_obtained,
          max_marks: exam.max_marks,
          percentage: (mark.marks_obtained / exam.max_marks * 100).toFixed(2),
          grade: this.getGrade(mark.marks_obtained / exam.max_marks * 100)
        });
      }
    });
    
    const overallPercentage = totalMaxMarks > 0 ? (totalMarks / totalMaxMarks * 100).toFixed(2) : 0;
    
    return {
      student_id: studentId,
      total_marks: totalMarks,
      total_max_marks: totalMaxMarks,
      percentage: overallPercentage,
      grade: this.getGrade(overallPercentage),
      subjects: subjectGrades
    };
  },

  getGrade(percentage) {
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B+';
    if (percentage >= 60) return 'B';
    if (percentage >= 50) return 'C';
    if (percentage >= 40) return 'D';
    return 'F';
  },

  deleteByExamId(examId) {
    const sheet = SheetService.getSheet(SHEET_NAMES.MARKS);
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    const toDelete = [];
    
    for (let i = 1; i < values.length; i++) {
      if (values[i][1] === examId) {
        toDelete.push(i + 1);
      }
    }
    
    toDelete.reverse().forEach(row => sheet.deleteRow(row));
    SpreadsheetApp.flush();
  }
};
