const RoleHandler = {
  getRoles(token) {
    if (!AuthHandler.isAdmin(token)) {
      return { success: false, error: 'Admin access required' };
    }
    
    const roles = RoleRepository.findAll();
    return { success: true, roles: roles };
  },

  createRole(token, data) {
    if (!AuthHandler.isAdmin(token)) {
      return { success: false, error: 'Admin access required' };
    }
    
    if (!data.role_name) {
      return { success: false, error: 'Role name is required' };
    }
    
    if (RoleRepository.exists(data.role_name)) {
      return { success: false, error: 'Role already exists' };
    }
    
    const role = RoleRepository.create({
      role_name: data.role_name,
      permissions: data.permissions || [],
      is_active: data.is_active !== false
    });
    
    return {
      success: true,
      message: 'Role created successfully',
      role: role
    };
  },

  updateRole(token, data) {
    if (!AuthHandler.isAdmin(token)) {
      return { success: false, error: 'Admin access required' };
    }
    
    if (!data.role_id) {
      return { success: false, error: 'Role ID is required' };
    }
    
    const updated = RoleRepository.update(data.role_id, {
      role_name: data.role_name,
      permissions: data.permissions,
      is_active: data.is_active
    });
    
    if (updated) {
      return { success: true, message: 'Role updated successfully' };
    }
    return { success: false, error: 'Role not found' };
  },

  deleteRole(token, data) {
    if (!AuthHandler.isAdmin(token)) {
      return { success: false, error: 'Admin access required' };
    }
    
    if (!data.role_id) {
      return { success: false, error: 'Role ID is required' };
    }
    
    const role = RoleRepository.findById(data.role_id);
    if (role && RoleRepository.isProtected(role.role_name)) {
      return { success: false, error: 'Cannot delete protected role' };
    }
    
    const deleted = RoleRepository.delete(data.role_id);
    if (deleted) {
      return { success: true, message: 'Role deleted successfully' };
    }
    return { success: false, error: 'Role not found' };
  },

  updateUserRole(token, data) {
    if (!AuthHandler.isAdmin(token)) {
      return { success: false, error: 'Admin access required' };
    }
    
    if (!data.user_id || !data.role) {
      return { success: false, error: 'User ID and role are required' };
    }
    
    const targetUser = UserRepository.findById(data.user_id);
    if (!targetUser) {
      return { success: false, error: 'User not found' };
    }
    
    const role = RoleRepository.findByName(data.role);
    if (!role) {
      return { success: false, error: 'Role not found' };
    }
    
    UserRepository.updateRole(data.user_id, data.role);
    
    return {
      success: true,
      message: 'User role updated successfully',
      user: { id: data.user_id, role: data.role }
    };
  }
};
