const auth = {
  TOKEN_KEY: '{STORAGE_PREFIX}_token',
  USER_KEY: '{STORAGE_PREFIX}_user',

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
    
    const rolePermissions = {ROLES_JSON};
    
    const permissions = rolePermissions[user.role]?.permissions || [];
    return permissions.includes('*') || permissions.includes(permission);
  }
};

if (typeof window !== 'undefined') {
  window.auth = auth;
}
