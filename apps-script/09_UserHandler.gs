const UserHandler = {
  createUser(token, data) {
    if (!token) {
      return { success: false, error: 'Token is required' };
    }
    
    const session = SessionRepository.findByToken(token);
    if (!session || !Utils.isValidSession(session)) {
      return { success: false, error: 'Invalid or expired session' };
    }
    
    const currentUser = UserRepository.findById(session[1]);
    if (!currentUser || currentUser.role !== 'admin') {
      return { success: false, error: 'Admin access required' };
    }
    
    if (!data.email || !data.password || !data.name) {
      return { success: false, error: 'Email, password, and name are required' };
    }
    
    if (UserRepository.existsByEmail(data.email)) {
      return { success: false, error: 'Email already exists' };
    }
    
    const passwordHash = Utils.hashPassword(data.password);
    const user = UserRepository.create({
      email: data.email,
      phone: data.phone || '',
      password_hash: passwordHash,
      role: data.role || 'student',
      name: data.name
    });
    
    return { 
      success: true, 
      message: 'User created successfully',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role
      }
    };
  },

  updateUser(token, data) {
    if (!token) {
      return { success: false, error: 'Token is required' };
    }
    
    const session = SessionRepository.findByToken(token);
    if (!session || !Utils.isValidSession(session)) {
      return { success: false, error: 'Invalid or expired session' };
    }
    
    const currentUser = UserRepository.findById(session[1]);
    if (!currentUser || currentUser.role !== 'admin') {
      return { success: false, error: 'Admin access required' };
    }
    
    if (!data.user_id) {
      return { success: false, error: 'User ID is required' };
    }
    
    const updateData = {};
    if (data.name) updateData.name = data.name;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.role) updateData.role = data.role;
    
    const user = UserRepository.update(data.user_id, updateData);
    
    if (!user) {
      return { success: false, error: 'User not found' };
    }
    
    return { 
      success: true, 
      message: 'User updated successfully',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role
      }
    };
  },

  deleteUser(token, data) {
    if (!token) {
      return { success: false, error: 'Token is required' };
    }
    
    const session = SessionRepository.findByToken(token);
    if (!session || !Utils.isValidSession(session)) {
      return { success: false, error: 'Invalid or expired session' };
    }
    
    const currentUser = UserRepository.findById(session[1]);
    if (!currentUser || currentUser.role !== 'admin') {
      return { success: false, error: 'Admin access required' };
    }
    
    if (!data.user_id) {
      return { success: false, error: 'User ID is required' };
    }
    
    if (data.user_id === currentUser.id) {
      return { success: false, error: 'Cannot delete your own account' };
    }
    
    const deleted = UserRepository.delete(data.user_id);
    
    if (!deleted) {
      return { success: false, error: 'User not found' };
    }
    
    return { 
      success: true, 
      message: 'User deleted successfully'
    };
  }
};
