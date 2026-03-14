const api = {
  baseUrl: window.API_URL || '',

  async request(endpoint, options = {}) {
    let url = `${this.baseUrl}${endpoint}`;
    const token = auth.getToken();

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    const fetchOptions = { ...options };
    if (fetchOptions.cache === 'false' || fetchOptions.cache === false) {
      const sep = url.includes('?') ? '&' : '?';
      url += `${sep}_t=${Date.now()}`;
      headers['X-Cache-Control'] = 'no-cache';
      fetchOptions.cache = 'no-cache';
    }

    if (token && !options.noAuth) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers
      });

      const text = await response.text();

      if (!response.ok) {
        if (response.status === 401) {
          console.warn('Authentication token expired or invalid. Logging out.');
          auth.logout();
          if (typeof window !== 'undefined') {
            window.location.href = 'index.html?msg=expired';
          }
        }

        let errorData;
        try {
          errorData = JSON.parse(text);
        } catch {
          errorData = { error: `HTTP ${response.status}` };
        }
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }

      if (!text || text.trim() === '') {
        return null;
      }

      const data = JSON.parse(text);
      return data;

    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  },

  async register(data) {
    return this.request('/register', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async login(email, password) {
    return this.request('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  },

  async logout(token) {
    return this.request('/logout', {
      method: 'POST',
      body: JSON.stringify({ token })
    });
  },

  async verify(token) {
    return this.request('/verify', {
      method: 'POST',
      body: JSON.stringify({ token })
    });
  },

  async getUsers(token, options = {}) {
    const body = {
      token,
      ...options
    };

    return this.request('/getUsers', {
      method: 'POST',
      body: JSON.stringify(body),
      ...options
    });
  },

  async getRoles(token, options = {}) {
    return this.request('/getRoles', {
      method: 'POST',
      body: JSON.stringify({ token }),
      ...options
    });
  },

  async createRole(token, data) {
    return this.request('/createRole', {
      method: 'POST',
      body: JSON.stringify({ token, ...data })
    });
  },

  async updateRole(token, data) {
    return this.request('/updateRole', {
      method: 'POST',
      body: JSON.stringify({ token, ...data })
    });
  },

  async deleteRole(token, data) {
    return this.request('/deleteRole', {
      method: 'POST',
      body: JSON.stringify({ token, ...data })
    });
  },

  async updateUserRole(token, data) {
    return this.request('/updateUserRole', {
      method: 'POST',
      body: JSON.stringify({ token, ...data })
    });
  },

  async createUser(token, data) {
    return this.request('/createUser', {
      method: 'POST',
      body: JSON.stringify({ token, ...data })
    });
  },

  async updateUser(token, data) {
    return this.request('/updateUser', {
      method: 'POST',
      body: JSON.stringify({ token, ...data })
    });
  },

  async deleteUser(token, data) {
    return this.request('/deleteUser', {
      method: 'POST',
      body: JSON.stringify({ token, ...data })
    });
  },

  async getStudents(token, options = {}) {
    const params = new URLSearchParams();
    params.append('token', token);
    if (options.class_id) params.append('class_id', options.class_id);
    if (options.section_id) params.append('section_id', options.section_id);
    if (options.status) params.append('status', options.status);
    if (options.limit) params.append('limit', options.limit);
    if (options.offset) params.append('offset', options.offset);

    return this.request('/getStudents?' + params.toString());
  },

  async createStudent(token, data) {
    return this.request('/createStudent', {
      method: 'POST',
      body: JSON.stringify({ token, ...data })
    });
  },

  async updateStudent(token, data) {
    return this.request('/updateStudent', {
      method: 'POST',
      body: JSON.stringify({ token, ...data })
    });
  },

  async deleteStudent(token, id) {
    return this.request('/deleteStudent', {
      method: 'POST',
      body: JSON.stringify({ token, id })
    });
  },

  async importStudents(token, csvData) {
    return this.request('/importStudents', {
      method: 'POST',
      body: JSON.stringify({ token, csv_data: csvData })
    });
  },

  async approveStudent(token, id) {
    return this.request('/approveStudent', {
      method: 'POST',
      body: JSON.stringify({ token, id })
    });
  },

  async markAttendance(token, data) {
    return this.request('/markAttendance', {
      method: 'POST',
      body: JSON.stringify({ token, ...data })
    });
  },

  async getAttendance(token, options = {}) {
    const params = new URLSearchParams();
    params.append('token', token);
    if (options.student_id) params.append('student_id', options.student_id);
    if (options.class) params.append('class', options.class);
    if (options.date) params.append('date', options.date);
    if (options.section) params.append('section', options.section);
    if (options.year) params.append('year', options.year);
    if (options.month) params.append('month', options.month);

    return this.request('/getAttendance?' + params.toString());
  },

  async getAttendanceByClass(token, classId, sectionId, date, requestOptions = {}) {
    const params = new URLSearchParams();
    params.append('token', token);
    if (classId) params.append('class', classId);
    if (sectionId) params.append('section', sectionId);
    if (date) params.append('date', date);
    if (requestOptions.year) params.append('year', requestOptions.year);
    if (requestOptions.month) params.append('month', requestOptions.month);
    if (requestOptions.cache) params.append('cache', requestOptions.cache);

    return this.request('/getAttendanceByClass?' + params.toString(), requestOptions);
  },

  async getAttendanceSummary(token, data) {
    return this.request('/getAttendanceSummary', {
      method: 'POST',
      body: JSON.stringify({ token, ...data })
    });
  },

  async getAttendanceByClassAndYear(token, classId, sectionId, year, requestOptions = {}) {
    const params = new URLSearchParams();
    params.append('token', token);
    if (classId) params.append('class_id', classId);
    if (sectionId) params.append('section_id', sectionId);
    if (year) params.append('year', year);
    if (requestOptions.cache) params.append('cache', requestOptions.cache);

    return this.request('/getAttendanceByClassAndYear?' + params.toString(), requestOptions);
  },

  async getSubjects(token, options = {}) {
    const params = new URLSearchParams();
    params.append('token', token);
    if (options.class) params.append('class', options.class);

    return this.request('/getSubjects?' + params.toString());
  },

  async createSubject(token, data) {
    return this.request('/createSubject', {
      method: 'POST',
      body: JSON.stringify({ token, ...data })
    });
  },

  async updateSubject(token, data) {
    return this.request('/updateSubject', {
      method: 'POST',
      body: JSON.stringify({ token, ...data })
    });
  },

  async deleteSubject(token, id) {
    return this.request('/deleteSubject', {
      method: 'POST',
      body: JSON.stringify({ token, id })
    });
  },

  async getExams(token, options = {}) {
    const params = new URLSearchParams();
    params.append('token', token);
    if (options.class) params.append('class', options.class);
    if (options.subject_id) params.append('subject_id', options.subject_id);
    if (options.date) params.append('date', options.date);

    return this.request('/getExams?' + params.toString());
  },

  async createExam(token, data) {
    return this.request('/createExam', {
      method: 'POST',
      body: JSON.stringify({ token, ...data })
    });
  },

  async updateExam(token, data) {
    return this.request('/updateExam', {
      method: 'POST',
      body: JSON.stringify({ token, ...data })
    });
  },

  async deleteExam(token, id) {
    return this.request('/deleteExam', {
      method: 'POST',
      body: JSON.stringify({ token, id })
    });
  },

  async getMarks(token, options = {}) {
    const params = new URLSearchParams();
    params.append('token', token);
    if (options.exam_id) params.append('exam_id', options.exam_id);
    if (options.student_id) params.append('student_id', options.student_id);

    return this.request('/getMarks?' + params.toString());
  },

  async enterMarks(token, data) {
    return this.request('/enterMarks', {
      method: 'POST',
      body: JSON.stringify({ token, ...data })
    });
  },

  async calculateGrades(token, data) {
    return this.request('/calculateGrades', {
      method: 'POST',
      body: JSON.stringify({ token, ...data })
    });
  },

  async generateReportCard(token, data) {
    const params = new URLSearchParams();
    params.append('token', token);
    params.append('student_id', data.student_id);
    if (data.year) params.append('year', data.year);

    return this.request('/generateReportCard?' + params.toString());
  },

  async getTimetable(token, options = {}) {
    const params = new URLSearchParams();
    params.append('token', token);
    if (options.class) params.append('class', options.class);
    if (options.section) params.append('section', options.section);
    if (options.teacher_id) params.append('teacher_id', options.teacher_id);
    if (options.day) params.append('day', options.day);

    return this.request('/getTimetable?' + params.toString());
  },

  async setTimetable(token, data) {
    return this.request('/setTimetable', {
      method: 'POST',
      body: JSON.stringify({ token, ...data })
    });
  },

  async deleteTimetable(token, id) {
    return this.request('/deleteTimetable', {
      method: 'POST',
      body: JSON.stringify({ token, id })
    });
  },

  async getSyllabus(token, options = {}) {
    const params = new URLSearchParams();
    params.append('token', token);
    if (options.class) params.append('class', options.class);
    if (options.subject_id) params.append('subject_id', options.subject_id);
    if (options.status) params.append('status', options.status);

    return this.request('/getSyllabus?' + params.toString());
  },

  async addSyllabus(token, data) {
    return this.request('/addSyllabus', {
      method: 'POST',
      body: JSON.stringify({ token, ...data })
    });
  },

  async updateSyllabus(token, data) {
    return this.request('/updateSyllabus', {
      method: 'POST',
      body: JSON.stringify({ token, ...data })
    });
  },

  async deleteSyllabus(token, id) {
    return this.request('/deleteSyllabus', {
      method: 'POST',
      body: JSON.stringify({ token, id })
    });
  },

  async getResources(token, options = {}) {
    const params = new URLSearchParams();
    params.append('token', token);
    if (options.class) params.append('class', options.class);
    if (options.subject_id) params.append('subject_id', options.subject_id);
    if (options.type) params.append('type', options.type);

    return this.request('/getResources?' + params.toString());
  },

  async addResource(token, data) {
    return this.request('/addResource', {
      method: 'POST',
      body: JSON.stringify({ token, ...data })
    });
  },

  async deleteResource(token, id) {
    return this.request('/deleteResource', {
      method: 'POST',
      body: JSON.stringify({ token, id })
    });
  },

  async linkParentStudent(token, data) {
    return this.request('/linkParentStudent', {
      method: 'POST',
      body: JSON.stringify({ token, ...data })
    });
  },

  async autoLinkParents(token) {
    return this.request('/autoLinkParents', {
      method: 'POST',
      body: JSON.stringify({ token })
    });
  },

  async getLinkedParents(token, studentId) {
    return this.request('/getLinkedParents', {
      method: 'POST',
      body: JSON.stringify({ token, student_id: studentId })
    });
  },

  async unlinkParentStudent(token, parentId, studentId) {
    return this.request('/unlinkParentStudent', {
      method: 'POST',
      body: JSON.stringify({ token, parent_id: parentId, student_id: studentId })
    });
  },

  async getClasses(token, options = {}) {
    const params = new URLSearchParams();
    params.append('token', token);
    if (options.school_id) params.append('school_id', options.school_id);
    return this.request('/getClasses?' + params.toString());
  },

  async getSchools(token, options = {}) {
    const params = new URLSearchParams();
    params.append('token', token);
    return this.request('/getSchools?' + params.toString(), options);
  },

  async createSchool(token, data) {
    return this.request('/createSchool', {
      method: 'POST',
      body: JSON.stringify({ token, ...data })
    });
  },

  async updateSchool(token, data) {
    return this.request('/updateSchool', {
      method: 'POST',
      body: JSON.stringify({ token, ...data })
    });
  },

  async deleteSchool(token, id) {
    return this.request('/deleteSchool', {
      method: 'POST',
      body: JSON.stringify({ token, id })
    });
  },

  async getSections(token, options = {}) {
    const params = new URLSearchParams();
    params.append('token', token);
    if (options.class_id) params.append('class_id', options.class_id);
    return this.request('/getSections?' + params.toString());
  },

  async createSection(token, data) {
    return this.request('/createSection', {
      method: 'POST',
      body: JSON.stringify({ token, ...data })
    });
  },

  async updateSection(token, data) {
    return this.request('/updateSection', {
      method: 'POST',
      body: JSON.stringify({ token, ...data })
    });
  },

  async deleteSection(token, id) {
    return this.request('/deleteSection', {
      method: 'POST',
      body: JSON.stringify({ token, id })
    });
  },

  async getLinkedStudents(token) {
    const params = new URLSearchParams();
    params.append('token', token);
    return this.request('/getLinkedStudents?' + params.toString());
  },

  async getMyMarks(token) {
    const params = new URLSearchParams();
    params.append('token', token);
    return this.request('/getMyMarks?' + params.toString());
  },

  async getMyTimetable(token) {
    const params = new URLSearchParams();
    params.append('token', token);
    return this.request('/getMyTimetable?' + params.toString());
  },

  async getDashboardStats(token) {
    const params = new URLSearchParams();
    params.append('token', token);
    return this.request('/getDashboardStats?' + params.toString());
  },

  async getPendingRegistrations(token, options = {}) {
    const params = new URLSearchParams();
    params.append('token', token);
    if (options.role) params.append('role', options.role);
    if (options.limit) params.append('limit', options.limit);
    if (options.offset) params.append('offset', options.offset);
    return this.request('/getPendingRegistrations?' + params.toString());
  },

  async approveUser(token, userId) {
    return this.request('/approveUser', {
      method: 'POST',
      body: JSON.stringify({ token, userId })
    });
  },

  async rejectUser(token, userId) {
    return this.request('/rejectUser', {
      method: 'POST',
      body: JSON.stringify({ token, userId })
    });
  },

  async createClass(token, data) {
    return this.request('/createClass', {
      method: 'POST',
      body: JSON.stringify({ token, ...data })
    });
  },

  async updateClass(token, data) {
    return this.request('/updateClass', {
      method: 'POST',
      body: JSON.stringify({ token, ...data })
    });
  },

  async deleteClass(token, id) {
    return this.request('/deleteClass', {
      method: 'POST',
      body: JSON.stringify({ token, id })
    });
  },

  async getNotices(token) {
    const params = new URLSearchParams();
    params.append('token', token);
    return this.request('/getNotices?' + params.toString());
  },

  async createNotice(token, data) {
    return this.request('/createNotice', {
      method: 'POST',
      body: JSON.stringify({ token, ...data })
    });
  },

  async updateNotice(token, data) {
    return this.request('/updateNotice', {
      method: 'POST',
      body: JSON.stringify({ token, ...data })
    });
  },

  async deleteNotice(token, id) {
    return this.request('/deleteNotice', {
      method: 'POST',
      body: JSON.stringify({ token, id })
    });
  },

  async getInvoices(token, options = {}) {
    const params = new URLSearchParams();
    params.append('token', token);
    if (options.id) params.append('id', options.id);
    if (options.student_id) params.append('student_id', options.student_id);
    if (options.status) params.append('status', options.status);
    if (options.academic_year) params.append('academic_year', options.academic_year);
    if (options.limit) params.append('limit', options.limit);
    if (options.offset) params.append('offset', options.offset);
    return this.request('/getInvoices?' + params.toString());
  },

  async createInvoice(token, data) {
    return this.request('/createInvoice', {
      method: 'POST',
      body: JSON.stringify({ token, ...data })
    });
  },

  async createBulkInvoices(token, data) {
    return this.request('/createBulkInvoices', {
      method: 'POST',
      body: JSON.stringify({ token, ...data })
    });
  },

  async updateInvoice(token, data) {
    return this.request('/updateInvoice', {
      method: 'POST',
      body: JSON.stringify({ token, ...data })
    });
  },

  async deleteInvoice(token, id) {
    return this.request('/deleteInvoice', {
      method: 'POST',
      body: JSON.stringify({ token, id })
    });
  },

  async createPaymentOrder(token, invoiceId) {
    return this.request('/createPaymentOrder', {
      method: 'POST',
      body: JSON.stringify({ token, invoice_id: invoiceId })
    });
  },

  async verifyPaymentStatus(token, orderId) {
    return this.request('/verifyPaymentStatus', {
      method: 'POST',
      body: JSON.stringify({ token, order_id: orderId })
    });
  },

  async getPaymentStatus(token, options = {}) {
    return this.request('/getPaymentStatus', {
      method: 'POST',
      body: JSON.stringify({ token, ...options })
    });
  },

  async getReceipt(token, options = {}) {
    const params = new URLSearchParams();
    params.append('token', token);
    if (options.id) params.append('id', options.id);
    if (options.receipt_no) params.append('receipt_no', options.receipt_no);
    if (options.transaction_id) params.append('transaction_id', options.transaction_id);
    return this.request('/getReceipt?' + params.toString());
  },

  async getPaymentConfig(token) {
    return this.request('/getPaymentConfig', {
      method: 'POST',
      body: JSON.stringify({ token })
    });
  },

  async savePaymentConfig(token, data) {
    return this.request('/savePaymentConfig', {
      method: 'POST',
      body: JSON.stringify({ token, ...data })
    });
  },

  async getFeeStructures(token, options = {}) {
    const params = new URLSearchParams();
    params.append('token', token);
    if (options.class) params.append('class', options.class);
    if (options.academic_year) params.append('academic_year', options.academic_year);
    if (options.fee_type) params.append('fee_type', options.fee_type);
    return this.request('/getFeeStructures?' + params.toString());
  },

  async createFeeStructure(token, data) {
    return this.request('/createFeeStructure', {
      method: 'POST',
      body: JSON.stringify({ token, ...data })
    });
  },

  async updateFeeStructure(token, data) {
    return this.request('/updateFeeStructure', {
      method: 'POST',
      body: JSON.stringify({ token, ...data })
    });
  },

  async deleteFeeStructure(token, id) {
    return this.request('/deleteFeeStructure', {
      method: 'POST',
      body: JSON.stringify({ token, id })
    });
  },

  async generateBulkInvoices(token, data) {
    return this.request('/generateBulkInvoices', {
      method: 'POST',
      body: JSON.stringify({ token, ...data })
    });
  },

  async generateSchoolInvoices(token, data) {
    return this.request('/generateSchoolInvoices', {
      method: 'POST',
      body: JSON.stringify({ token, ...data })
    });
  },

  async getAllInvoices(token, options = {}) {
    const params = new URLSearchParams();
    params.append('token', token);
    if (options.status) params.append('status', options.status);
    if (options.academic_year) params.append('academic_year', options.academic_year);
    if (options.class) params.append('class', options.class);
    if (options.limit) params.append('limit', options.limit);
    if (options.offset) params.append('offset', options.offset);
    return this.request('/getAllInvoices?' + params.toString());
  },

  async getDefaulterList(token, options = {}) {
    const params = new URLSearchParams();
    params.append('token', token);
    if (options.academic_year) params.append('academic_year', options.academic_year);
    return this.request('/getDefaulterList?' + params.toString());
  },

  async getPaymentAnalytics(token, options = {}) {
    const params = new URLSearchParams();
    params.append('token', token);
    if (options.academic_year) params.append('academic_year', options.academic_year);
    if (options.month) params.append('month', options.month);
    return this.request('/getPaymentAnalytics?' + params.toString());
  },

  async getFeeDashboardStats(token) {
    const params = new URLSearchParams();
    params.append('token', token);
    return this.request('/getFeeDashboardStats?' + params.toString());
  }
};

if (typeof window !== 'undefined') {
  window.api = api;
}
