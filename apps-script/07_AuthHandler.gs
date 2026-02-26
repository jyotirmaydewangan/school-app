function getValidRoles() {
  try {
    if (TENANT_CONFIG.ROLES) {
      return Object.keys(TENANT_CONFIG.ROLES);
    }
  } catch (e) {}
  return ['admin', 'teacher', 'parent', 'student'];
}

const AuthHandler = {
  register(data) {
    if (!data.email || !data.password || !data.name) {
      return { success: false, error: 'Email, password, and name are required' };
    }
    
    const existing = UserRepository.findByEmail(data.email);
    if (existing) {
      if (existing.rejected_at) {
        return { success: false, error: 'Your previous registration was rejected. Please contact administrator.' };
      }
      if (!existing.is_approved) {
        return { success: false, error: 'Registration pending approval. Please wait for admin to approve.' };
      }
      return { success: false, error: 'Email already registered' };
    }
    
    const validRoles = getValidRoles();
    const defaultRole = getDefaultRole();
    const userRole = data.role && validRoles.includes(data.role) ? data.role : defaultRole;
    const passwordHash = Utils.sha256(data.password);
    
    const user = UserRepository.create({
      email: data.email,
      phone: data.phone,
      password_hash: passwordHash,
      role: userRole,
      name: data.name
    });
    
    const isApprovalRequired = userRole !== 'admin' && userRole !== 'student';
    
    return {
      success: true,
      message: isApprovalRequired 
        ? 'Registration successful! Please wait for admin approval to login.' 
        : 'User registered successfully',
      pending_approval: isApprovalRequired,
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
    
    if (!user.is_approved) {
      if (user.rejected_at) {
        return { success: false, error: 'Your registration has been rejected. Please contact administrator.' };
      }
      return { success: false, error: 'Your registration is pending approval. Please wait for admin to approve.' };
    }
    
    const passwordHash = Utils.sha256(data.password);
    if (user.password_hash !== passwordHash) {
      return { success: false, error: 'Invalid credentials' };
    }
    
    const timeoutMinutes = ConfigService.get('session_timeout_minutes', 60);
    const jwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name
    };
    
    const token = Utils.createJWT(jwtPayload, timeoutMinutes);
    
    return {
      success: true,
      token: token,
      expiresIn: timeoutMinutes * 60,
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
    
    const jwtResult = Utils.verifyJWT(token);
    
    if (!jwtResult.valid) {
      return { 
        success: false, 
        error: jwtResult.error, 
        valid: false,
        expired: jwtResult.expired || false
      };
    }
    
    const payload = jwtResult.payload;
    
    return {
      success: true,
      valid: true,
      user: {
        id: payload.userId,
        email: payload.email,
        name: payload.name,
        role: payload.role
      }
    };
  },

  isAdmin(token) {
    if (!token) return false;
    const jwtResult = Utils.verifyJWT(token);
    if (!jwtResult.valid) return false;
    return jwtResult.payload.role === 'admin';
  }
};
