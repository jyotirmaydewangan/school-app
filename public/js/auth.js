const auth = {
  TOKEN_KEY: 'school_app_token',
  USER_KEY: 'school_app_user',

  setToken(token) {
    sessionStorage.setItem(this.TOKEN_KEY, token);
  },

  getToken() {
    return sessionStorage.getItem(this.TOKEN_KEY);
  },

  setUser(user) {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  },

  getUser() {
    const userStr = localStorage.getItem(this.USER_KEY);
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch (e) {
        return null;
      }
    }
    return null;
  },

  isLoggedIn() {
    return !!this.getToken();
  },

  logout() {
    sessionStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
  },

  hasRole(role) {
    const user = this.getUser();
    return user && user.role === role;
  },

  hasPermission(permission) {
    const user = this.getUser();
    if (!user) return false;
    
    const rolePermissions = {
      admin: ['*'],
      teacher: ['read:students', 'write:grades'],
      parent: ['read:own_child'],
      student: ['read:own_grades']
    };
    
    const permissions = rolePermissions[user.role] || [];
    return permissions.includes('*') || permissions.includes(permission);
  }
};

if (typeof window !== 'undefined') {
  window.auth = auth;
}
