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
            this.updateAttendance(existing.id, record.status, attendanceData.marked_by);
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
    const sheet = this.getAttendanceSheet(year, month);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][1]) === String(studentId) && String(data[i][2]) === String(date)) {
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

  updateAttendance(id, status, markedBy) {
    const data = this.getAllForMonth(new Date().getFullYear(), new Date().getMonth() + 1);
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === id) {
        const sheet = data[0].sheet;
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

  getByClassAndDate(className, date, section = null) {
    const year = parseInt(date.split('-')[0]);
    const month = parseInt(date.split('-')[1]);
    
    const students = StudentRepository.getStudentsByClass(className, section).students;
    const attendanceData = this.getAllForMonth(year, month);
    
    return students.map(student => {
      const record = attendanceData.data.find(a => 
        String(a.student_id) === String(student.id) && 
        String(a.date) === String(date)
      );
      
      return {
        student_id: student.id,
        student_name: student.name,
        admission_no: student.admission_no,
        status: record ? record.status : 'pending',
        marked_by: record ? record.marked_by : null
      };
    });
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
      const total = studentRecords.length;
      
      months.push({
        month: m,
        present,
        absent,
        late,
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
    const absences = data.data.filter(a => String(a.date) === String(date) && a.status === 'absent');
    
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
