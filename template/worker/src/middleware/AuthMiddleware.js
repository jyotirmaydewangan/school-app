export const AuthMiddleware = {
  extractToken(request) {
    const authHeader = request.headers.get('Authorization');
    return authHeader?.replace('Bearer ', '') || null;
  },

  addTokenToBody(body, token) {
    if (!token || !body) return body;

    try {
      const parsed = JSON.parse(body);
      parsed.token = token;
      return JSON.stringify(parsed);
    } catch {
      return body;
    }
  },

  isAuthRequired(action) {
    const noAuthActions = ['login', 'register', 'verify'];
    return !noAuthActions.includes(action);
  }
};
