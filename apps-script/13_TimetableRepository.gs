const TimetableRepository = {
  findAll(options = {}) {
    const sheet = SheetService.getSheet(SHEET_NAMES.TIMETABLE);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    let entries = data.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = row[i]);
      return obj;
    }).filter(t => t.id);
    
    if (options.class) {
      entries = entries.filter(t => String(t.class) === String(options.class));
    }
    
    if (options.section) {
      entries = entries.filter(t => String(t.section) === String(options.section));
    }
    
    if (options.day) {
      entries = entries.filter(t => t.day === options.day);
    }
    
    if (options.teacher_id) {
      entries = entries.filter(t => t.teacher_id === options.teacher_id);
    }
    
    return entries;
  },

  findById(id) {
    const sheet = SheetService.getSheet(SHEET_NAMES.TIMETABLE);
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
    const sheet = SheetService.getSheet(SHEET_NAMES.TIMETABLE);
    const id = Utilities.getUuid();
    
    const row = [
      id,
      data.class,
      data.section || '',
      data.day,
      data.period,
      data.start_time || '',
      data.end_time || '',
      data.subject_id,
      data.teacher_id,
      data.room || ''
    ];
    
    sheet.appendRow(row);
    SpreadsheetApp.flush();
    
    return { id, ...data };
  },

  update(id, data) {
    const sheet = SheetService.getSheet(SHEET_NAMES.TIMETABLE);
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    const headers = values[0];
    
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === id) {
        ['class', 'section', 'day', 'period', 'start_time', 'end_time', 'subject_id', 'teacher_id', 'room'].forEach(field => {
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
    const sheet = SheetService.getSheet(SHEET_NAMES.TIMETABLE);
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === id) {
        sheet.deleteRow(i + 1);
        SpreadsheetApp.flush();
        return { success: true };
      }
    }
    return { success: false, error: 'Timetable entry not found' };
  },

  getByClassAndDay(className, section, day) {
    return this.findAll({ class: className, section: section, day: day })
      .sort((a, b) => parseInt(a.period) - parseInt(b.period));
  },

  getByTeacherAndDay(teacherId, day) {
    return this.findAll({ teacher_id: teacherId, day: day })
      .sort((a, b) => parseInt(a.period) - parseInt(b.period));
  },

  getWeeklyTimetable(className, section) {
    const days = DAYS_OF_WEEK;
    const timetable = {};
    
    days.forEach(day => {
      timetable[day] = this.findAll({ class: className, section: section, day: day })
        .sort((a, b) => parseInt(a.period) - parseInt(b.period))
        .map(entry => {
          const subject = SubjectRepository.findById(entry.subject_id);
          const teacher = entry.teacher_id ? UserRepository.findById(entry.teacher_id) : null;
          
          return {
            ...entry,
            subject_name: subject ? subject.name : 'Unknown',
            teacher_name: teacher ? teacher.name : 'TBA'
          };
        });
    });
    
    return timetable;
  },

  setSubstitution(originalEntryId, substituteTeacherId, date) {
    return {
      original_entry_id: originalEntryId,
      substitute_teacher_id: substituteTeacherId,
      date: date,
      status: 'pending'
    };
  },

  getSubstitutions(teacherId, date) {
    return this.findAll({ teacher_id: teacherId }).filter(t => t.substituted);
  }
};

const DAYS_OF_WEEK = TENANT_CONFIG.ACADEMIC_DAYS || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const PERIODS = TENANT_CONFIG.ACADEMIC_PERIODS || {
  1: { start: '08:00', end: '08:45' },
  2: { start: '08:45', end: '09:30' },
  3: { start: '09:30', end: '10:15' },
  4: { start: '10:15', end: '11:00' },
  5: { start: '11:00', end: '11:45' },
  6: { start: '11:45', end: '12:30' },
  7: { start: '12:30', end: '13:15' },
  8: { start: '13:15', end: '14:00' }
};
