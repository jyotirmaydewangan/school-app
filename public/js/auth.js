const auth = {
  get STORAGE_PREFIX() {
    try {
      return window.TENANT_CONFIG?.TENANT_ID || 'school_app';
    } catch {
      return 'school_app';
    }
  },

  get TOKEN_KEY() { return this.STORAGE_PREFIX + '_token'; },
  get USER_KEY() { return this.STORAGE_PREFIX + '_user'; },
  get TOKEN_EXPIRES_KEY() { return this.STORAGE_PREFIX + '_token_expires'; },
  get VERIFY_CACHE_KEY() { return this.STORAGE_PREFIX + '_verify_cache'; },
  get VERIFY_CACHE_DURATION() { return Number('{VERIFY_CACHE_DURATION}') || 300000; },

  setToken(token, expiresIn = null) {
    sessionStorage.setItem(this.TOKEN_KEY, token);
    if (expiresIn) {
      const expiresAt = Date.now() + (expiresIn * 1000);
      sessionStorage.setItem(this.TOKEN_EXPIRES_KEY, expiresAt.toString());
    } else {
      const payload = this.parseJWT(token);
      if (payload && payload.exp) {
        const expiresAt = payload.exp * 1000;
        sessionStorage.setItem(this.TOKEN_EXPIRES_KEY, expiresAt.toString());
      }
    }
  },

  getToken() {
    return sessionStorage.getItem(this.TOKEN_KEY);
  },

  getTokenExpires() {
    const expiresStr = sessionStorage.getItem(this.TOKEN_EXPIRES_KEY);
    if (expiresStr) return parseInt(expiresStr);

    const token = this.getToken();
    if (token) {
      const payload = this.parseJWT(token);
      if (payload && payload.exp) {
        return payload.exp * 1000;
      }
    }
    return null;
  },

  isTokenExpired() {
    const expiresAt = this.getTokenExpires();
    if (!expiresAt) return true;
    return Date.now() >= expiresAt;
  },

  parseJWT(token) {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const payload = JSON.parse(atob(parts[1]));
      return payload;
    } catch {
      return null;
    }
  },

  isTokenExpiringSoon(thresholdMs = (Number('{TOKEN_THRESHOLD}') || 60000)) {
    const expiresAt = this.getTokenExpires();
    if (!expiresAt) return true;
    return Date.now() >= (expiresAt - thresholdMs);
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

  getCachedVerification() {
    const cacheStr = sessionStorage.getItem(this.VERIFY_CACHE_KEY);
    if (!cacheStr) return null;
    try {
      const cache = JSON.parse(cacheStr);
      if (Date.now() - cache.timestamp < this.VERIFY_CACHE_DURATION) {
        return cache.result;
      }
    } catch (e) { }
    return null;
  },

  setCachedVerification(result) {
    sessionStorage.setItem(this.VERIFY_CACHE_KEY, JSON.stringify({
      timestamp: Date.now(),
      result
    }));
  },

  clearVerificationCache() {
    sessionStorage.removeItem(this.VERIFY_CACHE_KEY);
  },

  isLoggedIn() {
    return !!this.getToken();
  },

  logout() {
    sessionStorage.removeItem(this.TOKEN_KEY);
    sessionStorage.removeItem(this.TOKEN_EXPIRES_KEY);
    sessionStorage.removeItem(this.VERIFY_CACHE_KEY);
    localStorage.removeItem(this.USER_KEY);
  },

  async fetchRoles() {
    const token = this.getToken();
    if (!token) return null;

    try {
      const response = await api.getRoles(token);
      if (response.success && response.roles) {
        const rolesMap = {};
        response.roles.forEach(r => {
          rolesMap[r.role_name] = {
            permissions: r.permissions,
            pages: r.pages,
            isActive: r.is_active
          };
        });
        localStorage.setItem(this.STORAGE_PREFIX + '_roles', JSON.stringify(rolesMap));
        return rolesMap;
      }
    } catch (e) {
      console.error('Failed to fetch roles', e);
    }
    return null;
  },

  hasRole(role) {
    const user = this.getUser();
    return user && user.role === role;
  },

  hasPermission(permission) {
    const user = this.getUser();
    if (!user) return false;

    // Priority 1: User-specific roles from localStorage (refreshed on login/sync)
    let rolePermissions = {};
    const cachedRoles = localStorage.getItem(this.STORAGE_PREFIX + '_roles');
    if (cachedRoles) {
      try {
        rolePermissions = JSON.parse(cachedRoles);
      } catch (e) {
        console.error('Failed to parse cached roles', e);
      }
    }

    // Priority 2: Fallback to injected ROLES_JSON
    if (Object.keys(rolePermissions).length === 0) {
      const injected = '{' + 'ROLES_JSON' + '}';
      const rawValue = '{ROLES_JSON}';
      if (rawValue !== injected && rawValue !== '' && rawValue !== '{}') {
        try {
          rolePermissions = JSON.parse(rawValue);
        } catch (e) {
          console.error('Failed to parse ROLES_JSON', e);
        }
      }
    }

    const roleData = rolePermissions[user.role] || {};
    const permissions = roleData.permissions || [];
    return permissions.includes('*') || permissions.includes(permission);
  },

  hasPageAccess(pageName) {
    if (!pageName) return true;
    const user = this.getUser();
    if (!user) return false;

    let rolePermissions = {};
    const cachedRoles = localStorage.getItem(this.STORAGE_PREFIX + '_roles');
    if (cachedRoles) {
      try {
        rolePermissions = JSON.parse(cachedRoles);
      } catch (e) { }
    }

    if (Object.keys(rolePermissions).length === 0) {
      const injected = '{' + 'ROLES_JSON' + '}';
      const rawValue = '{ROLES_JSON}';
      if (rawValue !== injected && rawValue !== '' && rawValue !== '{}') {
        try {
          rolePermissions = JSON.parse(rawValue);
        } catch (e) {
          console.error('Failed to parse ROLES_JSON for page access', e);
        }
      }
    }

    const roleData = rolePermissions[user.role] || {};
    const pages = roleData.pages || [];

    // Admin or wildcard page access
    if (user.role.toLowerCase() === 'admin' || pages.includes('*')) return true;

    return pages.includes(pageName);
  }
};

if (typeof window !== 'undefined') {
  window.auth = auth;
}
