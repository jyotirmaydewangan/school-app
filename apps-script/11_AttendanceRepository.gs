const AttendanceRepository = {
  getSheetName(year, month) {
    return `attendance_${year}_${String(month).padStart(2, '0')}`;
  },

  getAttendanceSheet(year, month) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = this.getSheetName(year, month);
    let sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(['id', 'student_id', 'date', 'period', 'status', 'marked_by', 'created_at']);
      SpreadsheetApp.flush();
    }
    
    return sheet;
  },

  formatDate(date) {
    if (!date) return '';
    if (Object.prototype.toString.call(date) === '[object Date]') {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      return Utilities.formatDate(date, ss.getSpreadsheetTimeZone(), "yyyy-MM-dd");
    }
    return String(date);
  },

  markAttendance(attendanceData) {
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    
    try {
      const date = attendanceData.date || new Date().toISOString().split('T')[0];
      const year = parseInt(date.split('-')[0]);
      const month = parseInt(date.split('-')[1]);
      
      const sheet = this.getAttendanceSheet(year, month);
      const results = { success: 0, failed: 0, errors: [] };
      
      const records = attendanceData.records || [];
      const batchSize = 50;
      
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        const rows = [];
        
        for (let j = 0; j < batch.length; j++) {
          const record = batch[j];
          
          const existing = this.findByStudentAndDate(record.student_id, date, year, month);
          if (existing) {
            this.updateAttendance(existing.id, record.status, attendanceData.marked_by, year, month);
            results.success++;
          } else {
            const id = Utilities.getUuid();
            const now = new Date().toISOString();
            
            rows.push([
              id,
              record.student_id,
              date,
              record.period || '1',
              record.status,
              attendanceData.marked_by || '',
              now
            ]);
            results.success++;
          }
        }
        
        if (rows.length > 0) {
          const lastRow = sheet.getLastRow();
          sheet.getRange(lastRow + 1, 1, rows.length, 7).setValues(rows);
          SpreadsheetApp.flush();
        }
      }
      
      return results;
    } finally {
      lock.releaseLock();
    }
  },

  findByStudentAndDate(studentId, date, year, month) {
    SpreadsheetApp.flush(); // Ensure latest data is visible
    const sheet = this.getAttendanceSheet(year, month);
    const data = sheet.getDataRange().getValues();
    
    // Search from bottom to top to find the most recent record if duplicates exist
    for (let i = data.length - 1; i >= 1; i--) {
      const sheetDate = this.formatDate(data[i][2]);
      if (String(data[i][1]).trim() === String(studentId).trim() && sheetDate === String(date)) {
        return {
          id: data[i][0],
          student_id: data[i][1],
          date: data[i][2],
          period: data[i][3],
          status: data[i][4],
          marked_by: data[i][5],
          created_at: data[i][6]
        };
      }
    }
    return null;
  },

  updateAttendance(id, status, markedBy, year, month) {
    const sheet = this.getAttendanceSheet(year, month);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === id) {
        data[i][4] = status;
        data[i][5] = markedBy;
        sheet.getRange(i + 1, 5, 1, 2).setValues([[status, markedBy]]);
        SpreadsheetApp.flush();
        return { success: true };
      }
    }
    return { success: false };
  },

  getAllForMonth(year, month) {
    const sheet = this.getAttendanceSheet(year, month);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    return {
      sheet: sheet,
      headers: headers,
      data: data.slice(1).map(row => {
        const obj = {};
        headers.forEach((h, i) => obj[h] = row[i]);
        return obj;
      })
    };
  },

  getByClassAndDate(classId, sectionId, date) {
    const year = parseInt(date.split('-')[0]);
    const month = parseInt(date.split('-')[1]);
    
    // Use getAllForMonth which is already efficient
    const data = this.getAllForMonth(year, month);
    const studentsResult = StudentRepository.findAll({ class_id: classId, section_id: sectionId, status: 'approved' });
    const students = studentsResult.students;
    
    const attendance = students.map(student => {
      // Find the LATEST entry for this student on this date
      // We search from bottom to top to respect the "Last Entry Wins" rule
      const record = data.data.slice().reverse().find(a => 
        String(a.student_id) === String(student.id) && 
        this.formatDate(a.date) === String(date)
      );
      
      return {
        student_id: student.id,
        student_name: student.name,
        admission_no: student.admission_no,
        status: record ? record.status : 'pending',
        marked_by: record ? record.marked_by : null
      };
    });
    
    return {
      success: true,
      class: ClassRepository.findById(classId)?.name,
      class_id: classId,
      section: SectionRepository.findById(sectionId)?.name,
      section_id: sectionId,
      date: date,
      students: attendance,
      total_students: students.length
    };
  },

  getByClassAndMonth(classId, sectionId, year, month) {
    const data = this.getAllForMonth(parseInt(year), parseInt(month));
    const studentsResult = StudentRepository.findAll({ class_id: classId, section_id: sectionId, status: 'approved' });
    const students = studentsResult.students;
    
    // We return ALL attendance records for matched students in this month
    // The worker/client will filter by date
    const attendanceRecords = data.data.filter(a => 
      students.some(s => String(s.id) === String(a.student_id))
    ).map(a => ({
      ...a,
      date: this.formatDate(a.date) // Normalize date for worker filtering
    }));

    return {
      success: true,
      class: ClassRepository.findById(classId)?.name,
      class_id: classId,
      section: SectionRepository.findById(sectionId)?.name,
      section_id: sectionId,
      year: year,
      month: month,
      students: students.map(s => ({ id: s.id, name: s.name, admission_no: s.admission_no })),
      attendance: attendanceRecords
    };
  },

  getByStudent(studentId, options = {}) {
    const results = [];
    const year = options.year || new Date().getFullYear();
    const month = options.month;
    
    if (month) {
      const data = this.getAllForMonth(year, month);
      const filtered = data.data.filter(a => String(a.student_id) === String(studentId));
      results.push(...filtered);
    } else {
      for (let m = 1; m <= 12; m++) {
        const data = this.getAllForMonth(year, m);
        const filtered = data.data.filter(a => String(a.student_id) === String(studentId));
        results.push(...filtered);
      }
    }
    
    return results;
  },

  getSummary(studentId, year) {
    const months = [];
    
    for (let m = 1; m <= 12; m++) {
      const data = this.getAllForMonth(year, m);
      const studentRecords = data.data.filter(a => String(a.student_id) === String(studentId));
      
      const present = studentRecords.filter(r => r.status === 'present').length;
      const absent = studentRecords.filter(r => r.status === 'absent').length;
      const late = studentRecords.filter(r => r.status === 'late').length;
      const leave = studentRecords.filter(r => r.status === 'leave').length;
      const total = studentRecords.length;
      
      months.push({
        month: m,
        present,
        absent,
        late,
        leave,
        total,
        percentage: total > 0 ? Math.round((present / total) * 100) : 0
      });
    }
    
    return months;
  },

  getAbsencesForNotification(date) {
    const year = parseInt(date.split('-')[0]);
    const month = parseInt(date.split('-')[1]);
    
    const data = this.getAllForMonth(year, month);
    const absences = data.data.filter(a => this.formatDate(a.date) === String(date) && a.status === 'absent');
    
    return absences.map(a => {
      const student = StudentRepository.findById(a.student_id);
      return {
        ...a,
        student_name: student ? student.name : 'Unknown',
        parent_phones: student ? [student.parent_phone1, student.parent_phone2].filter(p => p) : []
      };
    });
  }
};
