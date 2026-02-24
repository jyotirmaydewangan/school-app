const api = {
  baseUrl: window.API_URL || '',

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const token = auth.getToken();
    
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

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
  }
};

if (typeof window !== 'undefined') {
  window.api = api;
}
