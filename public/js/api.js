const api = {
  baseUrl: window.API_URL || '',

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const token = auth.getToken();

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (options.cache === 'false') {
      headers['X-Cache-Control'] = 'no-cache';
    }

    if (token && !options.noAuth) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      const text = await response.text();

      if (!response.ok) {
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
    const params = new URLSearchParams();
    params.append('token', token);
    if (options.limit) params.append('limit', options.limit);
    if (options.offset) params.append('offset', options.offset);

    return this.request('/getUsers', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(params))
    });
  },

  async getRoles(token) {
    return this.request('/getRoles', {
      method: 'POST',
      body: JSON.stringify({ token })
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
    if (options.class) params.append('class', options.class);
    if (options.section) params.append('section', options.section);
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

  async getAttendanceSummary(token, data) {
    return this.request('/getAttendanceSummary', {
      method: 'POST',
      body: JSON.stringify({ token, ...data })
    });
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

  async getClasses(token) {
    const params = new URLSearchParams();
    params.append('token', token);
    return this.request('/getClasses?' + params.toString());
  },

  async getLinkedStudents(token) {
    const params = new URLSearchParams();
    params.append('token', token);
    return this.request('/getLinkedStudents?' + params.toString());
  },

  async getMyAttendance(token) {
    const params = new URLSearchParams();
    params.append('token', token);
    return this.request('/getMyAttendance?' + params.toString());
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
  }
};

if (typeof window !== 'undefined') {
  window.api = api;
}
