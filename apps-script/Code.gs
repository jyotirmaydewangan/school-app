function doGet(e) {
  const params = e.parameter;
  const action = params.action;
  
  try {
    let result;
    
    switch (action) {
      case 'verify':
        result = AuthHandler.verify(params.token);
        break;
      case 'testJWT':
        const testPayload = { userId: 'test', email: 'test@test.com', role: 'admin', name: 'Test' };
        const testToken = Utils.createJWT(testPayload, 60);
        const verifyResult = Utils.verifyJWT(testToken);
        const secret = ConfigService.get('jwt_secret');
        
        const parts = testToken.split('.');
        const testSigInput = parts[0] + '.' + parts[1];
        const computedSigBytes = Utils.hmacSha256(testSigInput, secret);
        const computedSig = Utilities.base64Encode(computedSigBytes).replace(/=+$/, '');
        
        result = { 
          success: true, 
          tokenParts: { header: parts[0], payload: parts[1], signature: parts[2] },
          computedSignature: computedSig,
          actualSignature: parts[2],
          signatureMatch: computedSig === parts[2],
          verified: verifyResult,
          secretFound: !!secret,
          secret: secret ? secret.substring(0, 8) + '...' : null
        };
        break;
      case 'getUsers':
        result = handleGetUsers(params.token, {});
        break;
      case 'getConfig':
        result = { success: true, config: ConfigService.getAll() };
        break;
      case 'init':
        result = SheetService.initializeAll();
        break;
      case 'getStudents':
        result = handleGetStudents(params.token, params);
        break;
      case 'getAttendance':
        result = handleGetAttendance(params.token, params);
        break;
      case 'getMarks':
        result = handleGetMarks(params.token, params);
        break;
      case 'getTimetable':
        result = handleGetTimetable(params.token, params);
        break;
      case 'getSyllabus':
        result = handleGetSyllabus(params.token, params);
        break;
      case 'getResources':
        result = handleGetResources(params.token, params);
        break;
      case 'getSubjects':
        result = handleGetSubjects(params.token, params);
        break;
      case 'getExams':
        result = handleGetExams(params.token, params);
        break;
      case 'generateReportCard':
        result = handleGenerateReportCard(params.token, params);
        break;
      case 'getClasses':
        result = handleGetClasses(params.token);
        break;
      case 'getLinkedStudents':
        result = handleGetLinkedStudents(params.token);
        break;
      case 'createClass':
        result = handleCreateClass(params.token, params);
        break;
      case 'updateClass':
        result = handleUpdateClass(params.token, params);
        break;
      case 'deleteClass':
        result = handleDeleteClass(params.token, params);
        break;
      case 'getPendingRegistrations':
        result = handleGetPendingRegistrations(params.token, params);
        break;
      case 'approveUser':
        result = handleApproveUser(params.token, params);
        break;
      case 'rejectUser':
        result = handleRejectUser(params.token, params);
        break;
      case 'getDashboardStats':
        result = handleGetDashboardStats(params.token);
        break;
      case 'getSchools':
        result = handleGetSchools(params.token, params);
        break;
      case 'getSections':
        result = handleGetSections(params.token, params);
        break;
      default:
        result = { success: false, error: 'Unknown action' };
    }
    
    return createJsonResponse(result);
      
  } catch (error) {
    return createJsonResponse({ success: false, error: error.message });
  }
}

function doPost(e) {
  const params = e.parameter;
  
  let postData;
  try {
    postData = JSON.parse(e.postData.contents);
  } catch (err) {
    postData = {};
  }
  
  const action = params.action || postData.action;
  const token = params.token || postData.token;
  
  try {
    let result;
    
    switch (action) {
      case 'register':
        result = AuthHandler.register(postData);
        break;
      case 'login':
        result = AuthHandler.login(postData);
        break;
      case 'logout':
        result = AuthHandler.logout(token);
        break;
      case 'verify':
        result = AuthHandler.verify(token);
        break;
      case 'getUsers':
        result = handleGetUsers(token, postData);
        break;
      case 'getRoles':
        result = RoleHandler.getRoles(token);
        break;
      case 'createRole':
        result = RoleHandler.createRole(token, postData);
        break;
      case 'updateRole':
        result = RoleHandler.updateRole(token, postData);
        break;
      case 'deleteRole':
        result = RoleHandler.deleteRole(token, postData);
        break;
      case 'updateUserRole':
        result = RoleHandler.updateUserRole(token, postData);
        break;
      case 'createUser':
        result = UserHandler.createUser(token, postData);
        break;
      case 'updateUser':
        result = UserHandler.updateUser(token, postData);
        break;
      case 'deleteUser':
        result = UserHandler.deleteUser(token, postData);
        break;
      case 'init':
        result = SheetService.initializeAll();
        break;
      case 'createStudent':
        result = handleCreateStudent(token, postData);
        break;
      case 'updateStudent':
        result = handleUpdateStudent(token, postData);
        break;
      case 'deleteStudent':
        result = handleDeleteStudent(token, postData);
        break;
      case 'importStudents':
        result = handleImportStudents(token, postData);
        break;
      case 'approveStudent':
        result = handleApproveStudent(token, postData);
        break;
      case 'markAttendance':
        result = handleMarkAttendance(token, postData);
        break;
      case 'getAttendanceSummary':
        result = handleGetAttendanceSummary(token, postData);
        break;
      case 'createExam':
        result = handleCreateExam(token, postData);
        break;
      case 'updateExam':
        result = handleUpdateExam(token, postData);
        break;
      case 'deleteExam':
        result = handleDeleteExam(token, postData);
        break;
      case 'enterMarks':
        result = handleEnterMarks(token, postData);
        break;
      case 'calculateGrades':
        result = handleCalculateGrades(token, postData);
        break;
      case 'setTimetable':
        result = handleSetTimetable(token, postData);
        break;
      case 'deleteTimetable':
        result = handleDeleteTimetable(token, postData);
        break;
      case 'createSubject':
        result = handleCreateSubject(token, postData);
        break;
      case 'updateSubject':
        result = handleUpdateSubject(token, postData);
        break;
      case 'deleteSubject':
        result = handleDeleteSubject(token, postData);
        break;
      case 'addSyllabus':
        result = handleAddSyllabus(token, postData);
        break;
      case 'updateSyllabus':
        result = handleUpdateSyllabus(token, postData);
        break;
      case 'deleteSyllabus':
        result = handleDeleteSyllabus(token, postData);
        break;
      case 'addResource':
        result = handleAddResource(token, postData);
        break;
      case 'deleteResource':
        result = handleDeleteResource(token, postData);
        break;
      case 'linkParentStudent':
        result = handleLinkParentStudent(token, postData);
        break;
      case 'autoLinkParents':
        result = handleAutoLinkParents(token, postData);
        break;
      case 'createSchool':
        result = handleCreateSchool(token, postData);
        break;
      case 'updateSchool':
        result = handleUpdateSchool(token, postData);
        break;
      case 'deleteSchool':
        result = handleDeleteSchool(token, postData);
        break;
      case 'createSection':
        result = handleCreateSection(token, postData);
        break;
      case 'updateSection':
        result = handleUpdateSection(token, postData);
        break;
      case 'deleteSection':
        result = handleDeleteSection(token, postData);
        break;
      case 'createClass':
        result = handleCreateClass(token, postData);
        break;
      case 'updateClass':
        result = handleUpdateClass(token, postData);
        break;
      case 'deleteClass':
        result = handleDeleteClass(token, postData);
        break;
      case 'approveUser':
        result = handleApproveUser(token, postData);
        break;
      case 'rejectUser':
        result = handleRejectUser(token, postData);
        break;
      default:
        result = { success: false, error: 'Unknown action' };
    }
    
    return createJsonResponse(result);
      
  } catch (error) {
    return createJsonResponse({ success: false, error: error.message });
  }
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleGetUsers(token, params) {
  const auth = requireAdmin(token);
  if (!auth.success) return auth;
  
  const user = auth.user;
  
  const roles = RoleRepository.findAll();
  const rolesMap = {};
  roles.forEach(function(role) {
    rolesMap[role.role_name] = role;
  });
  
  const result = UserRepository.findAll({
    limit: params.limit ? parseInt(params.limit) : 0,
    offset: params.offset ? parseInt(params.offset) : 0
  });
  
  result.users = result.users.map(function(u) {
    if (rolesMap[u.role]) {
      u.role_details = rolesMap[u.role];
    }
    return u;
  });
  
  result.success = true;
  result.roles = roles;
  
  return result;
}

function checkAuth(token) {
  if (!token) {
    return { success: false, error: 'Token is required' };
  }
  
  const jwtResult = Utils.verifyJWT(token);
  if (!jwtResult.valid) {
    return { success: false, error: jwtResult.error, debug: { tokenLength: token.length, tokenPrefix: token.substring(0, 20) } };
  }
  
  const payload = jwtResult.payload;
  const user = UserRepository.findById(payload.userId);
  if (!user) {
    return { success: false, error: 'User not found' };
  }
  
  return { success: true, user: user };
}

function requireAdmin(token) {
  const auth = checkAuth(token);
  if (!auth.success) return auth;
  if (auth.user.role !== 'admin') {
    return { success: false, error: 'Admin access required' };
  }
  return auth;
}

function requireTeacherOrAdmin(token) {
  const auth = checkAuth(token);
  if (!auth.success) return auth;
  if (auth.user.role !== 'admin' && auth.user.role !== 'teacher') {
    return { success: false, error: 'Teacher or Admin access required' };
  }
  return auth;
}

function handleGetStudents(token, params) {
  const auth = checkAuth(token);
  if (!auth.success) return auth;
  
  const options = {
    class: params.class || params.class_name,
    section: params.section,
    status: params.status,
    limit: params.limit ? parseInt(params.limit) : 0,
    offset: params.offset ? parseInt(params.offset) : 0
  };
  
  const result = StudentRepository.findAll(options);
  
  const linkedStudents = ParentStudentRepository.findByParentId(auth.user.id).map(p => p.student_id);
  
  result.students = result.students.map(s => {
    s.is_linked = linkedStudents.includes(s.id);
    return s;
  });
  
  result.success = true;
  return result;
}

function handleCreateStudent(token, data) {
  const auth = requireAdmin(token);
  if (!auth.success) return auth;
  
  if (!data.name || !data.class) {
    return { success: false, error: 'Name and class are required' };
  }
  
  const existing = StudentRepository.findByAdmissionNo(data.admission_no);
  if (existing) {
    return { success: false, error: 'Admission number already exists' };
  }
  
  const result = StudentRepository.create(data);
  return { success: true, student: result };
}

function handleUpdateStudent(token, data) {
  const auth = requireAdmin(token);
  if (!auth.success) return auth;
  
  const result = StudentRepository.update(data.id, data);
  return result ? { success: true, student: result } : { success: false, error: 'Student not found' };
}

function handleDeleteStudent(token, data) {
  const auth = requireAdmin(token);
  if (!auth.success) return auth;
  
  return StudentRepository.delete(data.id);
}

function handleImportStudents(token, data) {
  const auth = requireAdmin(token);
  if (!auth.success) return auth;
  
  if (!data.csv_data) {
    return { success: false, error: 'CSV data is required' };
  }
  
  return StudentRepository.importFromCSV(data.csv_data);
}

function handleApproveStudent(token, data) {
  const auth = requireAdmin(token);
  if (!auth.success) return auth;
  
  const student = StudentRepository.findById(data.id);
  if (!student) {
    return { success: false, error: 'Student not found' };
  }
  
  return StudentRepository.update(data.id, { status: 'approved' });
}

function handleMarkAttendance(token, data) {
  const auth = requireTeacherOrAdmin(token);
  if (!auth.success) return auth;
  
  if (!data.date || !data.class || !data.records) {
    return { success: false, error: 'Date, class, and records are required' };
  }
  
  data.marked_by = auth.user.id;
  const result = AttendanceRepository.markAttendance(data);
  
  return { success: true, ...result };
}

function handleGetAttendance(token, params) {
  const auth = checkAuth(token);
  if (!auth.success) return auth;
  
  if (params.student_id) {
    const year = params.year ? parseInt(params.year) : new Date().getFullYear();
    const month = params.month ? parseInt(params.month) : null;
    
    const attendance = AttendanceRepository.getByStudent(params.student_id, { year, month });
    return { success: true, attendance };
  }
  
  if (params.class && params.date) {
    const result = AttendanceRepository.getByClassAndDate(params.class, params.date, params.section);
    return { success: true, records: result };
  }
  
  return { success: false, error: 'Invalid parameters' };
}

function handleGetAttendanceSummary(token, data) {
  const auth = checkAuth(token);
  if (!auth.success) return auth;
  
  if (!data.student_id) {
    return { success: false, error: 'Student ID is required' };
  }
  
  const year = data.year ? parseInt(data.year) : new Date().getFullYear();
  const summary = AttendanceRepository.getSummary(data.student_id, year);
  
  return { success: true, summary };
}

function handleGetSubjects(token, params) {
  const auth = checkAuth(token);
  if (!auth.success) return auth;
  
  const options = {};
  if (params.class) options.class = params.class;
  
  const subjects = SubjectRepository.findAll(options);
  return { success: true, subjects };
}

function handleCreateSubject(token, data) {
  const auth = requireAdmin(token);
  if (!auth.success) return auth;
  
  if (!data.name || !data.class) {
    return { success: false, error: 'Name and class are required' };
  }
  
  const result = SubjectRepository.create(data);
  return { success: true, subject: result };
}

function handleUpdateSubject(token, data) {
  const auth = requireAdmin(token);
  if (!auth.success) return auth;
  
  const result = SubjectRepository.update(data.id, data);
  return result ? { success: true, subject: result } : { success: false, error: 'Subject not found' };
}

function handleDeleteSubject(token, data) {
  const auth = requireAdmin(token);
  if (!auth.success) return auth;
  
  return SubjectRepository.delete(data.id);
}

function handleGetExams(token, params) {
  const auth = checkAuth(token);
  if (!auth.success) return auth;
  
  const options = {};
  if (params.class) options.class = params.class;
  if (params.subject_id) options.subject_id = params.subject_id;
  if (params.date) options.date = params.date;
  
  const exams = ExamRepository.findAll(options);
  return { success: true, exams };
}

function handleCreateExam(token, data) {
  const auth = requireTeacherOrAdmin(token);
  if (!auth.success) return auth;
  
  if (!data.name || !data.class || !data.subject_id || !data.date) {
    return { success: false, error: 'Name, class, subject, and date are required' };
  }
  
  const result = ExamRepository.create(data);
  return { success: true, exam: result };
}

function handleUpdateExam(token, data) {
  const auth = requireTeacherOrAdmin(token);
  if (!auth.success) return auth;
  
  const result = ExamRepository.update(data.id, data);
  return result ? { success: true, exam: result } : { success: false, error: 'Exam not found' };
}

function handleDeleteExam(token, data) {
  const auth = requireTeacherOrAdmin(token);
  if (!auth.success) return auth;
  
  return ExamRepository.delete(data.id);
}

function handleGetMarks(token, params) {
  const auth = checkAuth(token);
  if (!auth.success) return auth;
  
  if (params.exam_id) {
    const marks = MarksRepository.getByExam(params.exam_id);
    return { success: true, marks };
  }
  
  if (params.student_id) {
    const marks = MarksRepository.getByStudent(params.student_id);
    return { success: true, marks };
  }
  
  return { success: false, error: 'Invalid parameters' };
}

function handleEnterMarks(token, data) {
  const auth = requireTeacherOrAdmin(token);
  if (!auth.success) return auth;
  
  if (!data.exam_id || !data.records) {
    return { success: false, error: 'Exam ID and records are required' };
  }
  
  const result = MarksRepository.enterMarks(data.exam_id, data);
  return { success: true, ...result };
}

function handleCalculateGrades(token, data) {
  const auth = checkAuth(token);
  if (!auth.success) return auth;
  
  if (!data.student_id) {
    return { success: false, error: 'Student ID is required' };
  }
  
  const result = MarksRepository.calculateGrades(data.student_id, data.exam_ids);
  return { success: true, grades: result };
}

function handleGenerateReportCard(token, params) {
  const auth = checkAuth(token);
  if (!auth.success) return auth;
  
  if (!params.student_id) {
    return { success: false, error: 'Student ID is required' };
  }
  
  const student = StudentRepository.findById(params.student_id);
  if (!student) {
    return { success: false, error: 'Student not found' };
  }
  
  const year = params.year ? parseInt(params.year) : new Date().getFullYear();
  const grades = MarksRepository.calculateGrades(params.student_id);
  const attendance = AttendanceRepository.getSummary(params.student_id, year);
  
  const html = generateReportCardHTML(student, grades, attendance, year);
  
  return { success: true, html: html };
}

function generateReportCardHTML(student, grades, attendance, year) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Report Card - ${student.name}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 30px; }
    .student-info { margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #4CAF50; color: white; }
    .grade-a { background-color: #e8f5e9; }
    .grade-f { background-color: #ffebee; }
    .summary { margin-top: 20px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>School Report Card</h1>
    <p>Academic Year ${year}</p>
  </div>
  
  <div class="student-info">
    <p><strong>Student Name:</strong> ${student.name}</p>
    <p><strong>Admission No:</strong> ${student.admission_no}</p>
    <p><strong>Class:</strong> ${student.class} - ${student.section}</p>
  </div>
  
  <h2>Academic Performance</h2>
  <table>
    <tr>
      <th>Subject</th>
      <th>Marks</th>
      <th>Max Marks</th>
      <th>Percentage</th>
      <th>Grade</th>
    </tr>
    ${grades.subjects.map(s => `
    <tr class="grade-${s.grade.charAt(0).toLowerCase()}">
      <td>${s.subject}</td>
      <td>${s.marks}</td>
      <td>${s.max_marks}</td>
      <td>${s.percentage}%</td>
      <td>${s.grade}</td>
    </tr>
    `).join('')}
    <tr style="font-weight: bold; background-color: #f5f5f5;">
      <td>Overall</td>
      <td>${grades.total_marks}</td>
      <td>${grades.total_max_marks}</td>
      <td>${grades.percentage}%</td>
      <td>${grades.grade}</td>
    </tr>
  </table>
  
  <div class="summary">
    <h2>Attendance Summary</h2>
    <table>
      <tr>
        <th>Month</th>
        <th>Present</th>
        <th>Absent</th>
        <th>Late</th>
        <th>Percentage</th>
      </tr>
      ${attendance.map(m => `
      <tr>
        <td>${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m.month - 1]}</td>
        <td>${m.present}</td>
        <td>${m.absent}</td>
        <td>${m.late}</td>
        <td>${m.percentage}%</td>
      </tr>
      `).join('')}
    </table>
  </div>
  
  <div style="margin-top: 40px; text-align: center;">
    <button onclick="window.print()" style="padding: 10px 20px; font-size: 16px; cursor: pointer;">Print / Save as PDF</button>
  </div>
</body>
</html>
  `;
}

function handleGetTimetable(token, params) {
  const auth = checkAuth(token);
  if (!auth.success) return auth;
  
  if (params.class) {
    const timetable = TimetableRepository.getWeeklyTimetable(params.class, params.section || '');
    return { success: true, timetable };
  }
  
  if (params.teacher_id && params.day) {
    const timetable = TimetableRepository.getByTeacherAndDay(params.teacher_id, params.day);
    return { success: true, timetable };
  }
  
  return { success: false, error: 'Invalid parameters' };
}

function handleSetTimetable(token, data) {
  const auth = requireAdmin(token);
  if (!auth.success) return auth;
  
  if (!data.class || !data.day || !data.period) {
    return { success: false, error: 'Class, day, and period are required' };
  }
  
  if (data.id) {
    const result = TimetableRepository.update(data.id, data);
    return result ? { success: true, entry: result } : { success: false, error: 'Entry not found' };
  }
  
  const result = TimetableRepository.create(data);
  return { success: true, entry: result };
}

function handleDeleteTimetable(token, data) {
  const auth = requireAdmin(token);
  if (!auth.success) return auth;
  
  return TimetableRepository.delete(data.id);
}

function handleGetSyllabus(token, params) {
  const auth = checkAuth(token);
  if (!auth.success) return auth;
  
  if (params.class && params.subject_id) {
    const syllabus = SyllabusRepository.getByClassAndSubject(params.class, params.subject_id);
    const progress = SyllabusRepository.getProgress(params.class, params.subject_id);
    return { success: true, syllabus, progress };
  }
  
  const options = {};
  if (params.class) options.class = params.class;
  if (params.subject_id) options.subject_id = params.subject_id;
  if (params.status) options.status = params.status;
  
  const syllabus = SyllabusRepository.findAll(options);
  return { success: true, syllabus };
}

function handleAddSyllabus(token, data) {
  const auth = requireTeacherOrAdmin(token);
  if (!auth.success) return auth;
  
  if (!data.class || !data.subject_id || !data.topic) {
    return { success: false, error: 'Class, subject, and topic are required' };
  }
  
  const result = SyllabusRepository.create(data);
  return { success: true, syllabus: result };
}

function handleUpdateSyllabus(token, data) {
  const auth = requireTeacherOrAdmin(token);
  if (!auth.success) return auth;
  
  const result = SyllabusRepository.update(data.id, data);
  return result ? { success: true, syllabus: result } : { success: false, error: 'Syllabus not found' };
}

function handleDeleteSyllabus(token, data) {
  const auth = requireTeacherOrAdmin(token);
  if (!auth.success) return auth;
  
  return SyllabusRepository.delete(data.id);
}

function handleGetResources(token, params) {
  const auth = checkAuth(token);
  if (!auth.success) return auth;
  
  const options = {};
  if (params.class) options.class = params.class;
  if (params.subject_id) options.subject_id = params.subject_id;
  if (params.type) options.type = params.type;
  
  const resources = ResourceRepository.findAll(options);
  return { success: true, resources };
}

function handleAddResource(token, data) {
  const auth = requireTeacherOrAdmin(token);
  if (!auth.success) return auth;
  
  if (!data.class || !data.subject_id || !data.title || !data.type) {
    return { success: false, error: 'Class, subject, title, and type are required' };
  }
  
  const result = ResourceRepository.create(data);
  return { success: true, resource: result };
}

function handleDeleteResource(token, data) {
  const auth = requireTeacherOrAdmin(token);
  if (!auth.success) return auth;
  
  return ResourceRepository.delete(data.id);
}

function handleLinkParentStudent(token, data) {
  const auth = requireAdmin(token);
  if (!auth.success) return auth;
  
  if (!data.parent_id || !data.student_id) {
    return { success: false, error: 'Parent ID and Student ID are required' };
  }
  
  return ParentStudentRepository.link(data.parent_id, data.student_id);
}

function handleAutoLinkParents(token, data) {
  const auth = requireAdmin(token);
  if (!auth.success) return auth;
  
  return ParentStudentRepository.autoLinkByPhone();
}

function handleGetClasses(token, params) {
  const auth = checkAuth(token);
  if (!auth.success) return auth;
  
  const options = {};
  if (params && params.is_active !== undefined) {
    options.is_active = params.is_active === 'true';
  }
  if (params && params.academic_year) {
    options.academic_year = params.academic_year;
  }
  
  const result = ClassRepository.findAll(options);
  return { success: true, classes: result.classes, total: result.total };
}

function handleCreateClass(token, params) {
  const auth = requireAdmin(token);
  if (!auth.success) return auth;
  
  const data = {
    name: params.name,
    stream: params.stream || 'General',
    academic_year: params.academic_year,
    is_active: params.is_active !== 'false'
  };
  
  if (!data.name) {
    return { success: false, error: 'Class name is required' };
  }
  
  const classObj = ClassRepository.create(data);
  if (classObj.success === false) {
    return classObj;
  }
  
  return { success: true, class: classObj };
}

function handleUpdateClass(token, params) {
  const auth = requireAdmin(token);
  if (!auth.success) return auth;
  
  if (!params.id) {
    return { success: false, error: 'Class ID is required' };
  }
  
  const data = {};
  if (params.name !== undefined) data.name = params.name;
  if (params.stream !== undefined) data.stream = params.stream;
  if (params.academic_year !== undefined) data.academic_year = params.academic_year;
  if (params.is_active !== undefined) data.is_active = params.is_active === 'true';
  
  const classObj = ClassRepository.update(params.id, data);
  if (!classObj) {
    return { success: false, error: 'Class not found' };
  }
  
  return { success: true, class: classObj };
}

function handleDeleteClass(token, params) {
  const auth = requireAdmin(token);
  if (!auth.success) return auth;
  
  if (!params.id) {
    return { success: false, error: 'Class ID is required' };
  }
  
  const deleted = ClassRepository.delete(params.id);
  if (!deleted) {
    return { success: false, error: 'Class not found' };
  }
  
  return { success: true, message: 'Class deleted successfully' };
}

function handleGetPendingRegistrations(token, params) {
  const auth = requireAdmin(token);
  if (!auth.success) return auth;
  
  const options = {};
  if (params.role) {
    options.role = params.role;
  }
  if (params.limit) {
    options.limit = parseInt(params.limit);
  }
  if (params.offset) {
    options.offset = parseInt(params.offset);
  }
  
  const result = UserRepository.findPending(options);
  return { success: true, users: result.users, total: result.total };
}

function handleApproveUser(token, params) {
  const auth = requireAdmin(token);
  if (!auth.success) return auth;
  
  if (!params.userId) {
    return { success: false, error: 'User ID is required' };
  }
  
  const user = UserRepository.approveUser(params.userId);
  if (!user) {
    return { success: false, error: 'User not found' };
  }
  
  return { success: true, message: 'User approved successfully', user: user };
}

function handleRejectUser(token, params) {
  const auth = requireAdmin(token);
  if (!auth.success) return auth;
  
  if (!params.userId) {
    return { success: false, error: 'User ID is required' };
  }
  
  const user = UserRepository.rejectUser(params.userId);
  if (!user) {
    return { success: false, error: 'User not found' };
  }
  
  return { success: true, message: 'User rejected successfully', user: user };
}

function handleGetDashboardStats(token) {
  const auth = requireAdmin(token);
  if (!auth.success) return auth;
  
  const usersResult = UserRepository.findAll({});
  const pendingCount = UserRepository.countPending();
  const classesResult = ClassRepository.findAll({});
  
  const users = usersResult.users;
  const teachers = users.filter(u => u.role === 'teacher').length;
  const parents = users.filter(u => u.role === 'parent').length;
  const students = users.filter(u => u.role === 'student').length;
  
  return {
    success: true,
    stats: {
      total_users: users.length,
      total_students: students,
      total_teachers: teachers,
      total_parents: parents,
      total_classes: classesResult.total,
      pending_approvals: pendingCount
    }
  };
}

function handleGetLinkedStudents(token) {
  const auth = checkAuth(token);
  if (!auth.success) return auth;
  
  if (auth.user.role !== 'parent' && auth.user.role !== 'student') {
    return { success: false, error: 'Parent or Student access required' };
  }
  
  let studentIds = [];
  
  if (auth.user.role === 'parent') {
    const links = ParentStudentRepository.findByParentId(auth.user.id);
    studentIds = links.map(l => l.student_id);
  } else if (auth.user.role === 'student') {
    const students = StudentRepository.findAll({}).students;
    const userStudent = students.filter(s => s.user_id === auth.user.id);
    studentIds = userStudent.map(s => s.id);
  }
  
  const students = studentIds.map(id => StudentRepository.findById(id)).filter(s => s);
  
  return { success: true, students: students };
}

function handleGetMyAttendance(token) {
  const auth = checkAuth(token);
  if (!auth.success) return auth;
  
  let studentIds = [];
  
  if (auth.user.role === 'parent') {
    const links = ParentStudentRepository.findByParentId(auth.user.id);
    studentIds = links.map(l => l.student_id);
  } else if (auth.user.role === 'student') {
    const students = StudentRepository.findAll({}).students;
    const userStudent = students.filter(s => s.user_id === auth.user.id);
    studentIds = userStudent.map(s => s.id);
  } else {
    return { success: false, error: 'Invalid role for this action' };
  }
  
  const year = new Date().getFullYear();
  const attendanceData = {};
  
  studentIds.forEach(studentId => {
    attendanceData[studentId] = AttendanceRepository.getSummary(studentId, year);
  });
  
  return { success: true, attendance: attendanceData };
}

function handleGetMyMarks(token) {
  const auth = checkAuth(token);
  if (!auth.success) return auth;
  
  let studentIds = [];
  
  if (auth.user.role === 'parent') {
    const links = ParentStudentRepository.findByParentId(auth.user.id);
    studentIds = links.map(l => l.student_id);
  } else if (auth.user.role === 'student') {
    const students = StudentRepository.findAll({}).students;
    const userStudent = students.filter(s => s.user_id === auth.user.id);
    studentIds = userStudent.map(s => s.id);
  } else {
    return { success: false, error: 'Invalid role for this action' };
  }
  
  const marksData = {};
  
  studentIds.forEach(studentId => {
    marksData[studentId] = MarksRepository.calculateGrades(studentId);
  });
  
  return { success: true, marks: marksData };
}

function handleGetMyTimetable(token) {
  const auth = checkAuth(token);
  if (!auth.success) return auth;
  
  let studentIds = [];
  let className = null;
  let section = null;
  
  if (auth.user.role === 'parent') {
    const links = ParentStudentRepository.findByParentId(auth.user.id);
    studentIds = links.map(l => l.student_id);
  } else if (auth.user.role === 'student') {
    const students = StudentRepository.findAll({}).students;
    const userStudent = students.filter(s => s.user_id === auth.user.id);
    studentIds = userStudent.map(s => s.id);
  } else if (auth.user.role === 'teacher') {
    const timetable = TimetableRepository.findAll({ teacher_id: auth.user.id });
    return { success: true, timetable: timetable };
  }
  
  if (studentIds.length > 0) {
    const student = StudentRepository.findById(studentIds[0]);
    if (student) {
      className = student.class;
      section = student.section;
    }
  }
  
  if (!className) {
    return { success: false, error: 'No class assigned' };
  }
  
  const timetable = TimetableRepository.getWeeklyTimetable(className, section || '');

  return { success: true, timetable: timetable };
}

// --- School Handlers ---

function handleGetSchools(token, params) {
  const auth = checkAuth(token);
  if (!auth.success) return auth;
  
  const options = {};
  if (params.id) return { success: true, school: SchoolRepository.findById(params.id) };
  
  const schools = SchoolRepository.findAll();
  Logger.log('Schools found: ' + JSON.stringify(schools));
  return { success: true, schools };
}

function handleCreateSchool(token, data) {
  const auth = requireAdmin(token);
  if (!auth.success) return auth;
  
  if (!data.name) return { success: false, error: 'School name is required' };
  
  const existingSchools = SchoolRepository.findAll();
  if (existingSchools.total > 0) {
    return { success: false, error: 'A school profile already exists. Please edit the existing school profile.' };
  }
  
  const school = SchoolRepository.create(data);
  return { success: true, school };
}

function handleUpdateSchool(token, data) {
  const auth = requireAdmin(token);
  if (!auth.success) return auth;
  
  const school = SchoolRepository.update(data.id, data);
  return school ? { success: true, school } : { success: false, error: 'School not found' };
}

function handleDeleteSchool(token, data) {
  const auth = requireAdmin(token);
  if (!auth.success) return auth;
  
  const deleted = SchoolRepository.delete(data.id);
  return deleted ? { success: true } : { success: false, error: 'School not found' };
}

// --- Section Handlers ---

function handleGetSections(token, params) {
  const auth = checkAuth(token);
  if (!auth.success) return auth;
  
  const options = {};
  if (params && params.class_id) {
    options.class_id = params.class_id;
  }
  const result = SectionRepository.findAll(options);
  return { success: true, sections: result.sections };
}

function handleCreateSection(token, data) {
  const auth = requireAdmin(token);
  if (!auth.success) return auth;
  
  if (!data.class_id || !data.name) return { success: false, error: 'Class ID and Name are required' };
  
  const section = SectionRepository.create(data);
  return { success: true, section };
}

function handleUpdateSection(token, data) {
  const auth = requireAdmin(token);
  if (!auth.success) return auth;
  
  const section = SectionRepository.update(data.id, data);
  return section ? { success: true, section } : { success: false, error: 'Section not found' };
}

function handleDeleteSection(token, data) {
  const auth = requireAdmin(token);
  if (!auth.success) return auth;
  
  const deleted = SectionRepository.delete(data.id);
  return deleted ? { success: true } : { success: false, error: 'Section not found' };
}
