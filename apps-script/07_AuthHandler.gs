const AuthHandler = {
  register(data) {
    if (!data.email || !data.password || !data.name) {
      return { success: false, error: 'Email, password, and name are required' };
    }
    
    if (UserRepository.existsByEmail(data.email)) {
      return { success: false, error: 'Email already registered' };
    }
    
    const validRoles = ['admin', 'teacher', 'parent', 'student'];
    const userRole = data.role && validRoles.includes(data.role) ? data.role : 'student';
    const passwordHash = Utils.sha256(data.password);
    
    const user = UserRepository.create({
      email: data.email,
      phone: data.phone,
      password_hash: passwordHash,
      role: userRole,
      name: data.name
    });
    
    return {
      success: true,
      message: 'User registered successfully',
      user: { id: user.id, email: user.email, phone: user.phone, name: user.name, role: user.role }
    };
  },

  login(data) {
    if (!data.email || !data.password) {
      return { success: false, error: 'Email and password are required' };
    }
    
    const user = UserRepository.findByEmail(data.email);
    if (!user) {
      return { success: false, error: 'Invalid credentials' };
    }
    
    const passwordHash = Utils.sha256(data.password);
    if (user.password_hash !== passwordHash) {
      return { success: false, error: 'Invalid credentials' };
    }
    
    const session = SessionRepository.create({ userId: user.id });
    
    return {
      success: true,
      token: session.token,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        name: user.name,
        role: user.role
      }
    };
  },

  logout(token) {
    if (!token) {
      return { success: false, error: 'Token is required' };
    }
    
    const deleted = SessionRepository.delete(token);
    if (deleted) {
      return { success: true, message: 'Logged out successfully' };
    }
    return { success: false, error: 'Session not found' };
  },

  verify(token) {
    if (!token) {
      return { success: false, error: 'Token is required', valid: false };
    }
    
    const session = SessionRepository.findByToken(token);
    if (!session) {
      return { success: false, error: 'Session not found', valid: false };
    }
    
    if (!Utils.isValidSession(session)) {
      return { success: false, error: 'Session expired', valid: false };
    }
    
    SessionRepository.updateActivity(session[0]);
    
    const user = UserRepository.findById(session[1]);
    if (!user) {
      return { success: false, error: 'User not found', valid: false };
    }
    
    return {
      success: true,
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        name: user.name,
        role: user.role
      }
    };
  },

  isAdmin(token) {
    const session = SessionRepository.findByToken(token);
    if (!session || !Utils.isValidSession(session)) {
      return false;
    }
    
    const user = UserRepository.findById(session[1]);
    return user && user.role === 'admin';
  }
};
