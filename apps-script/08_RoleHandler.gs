const RoleHandler = {
  getRoles(token) {
    const auth = checkAuth(token);
    if (!auth.success) return auth;
    
    const roles = RoleRepository.findAll();
    return { success: true, roles: roles };
  },

  createRole(token, data) {
    const auth = requirePermission(token, 'write:users');
    if (!auth.success) return auth;
    
    if (!data.role_name) {
      return { success: false, error: 'Role name is required' };
    }
    
    if (RoleRepository.exists(data.role_name)) {
      return { success: false, error: 'Role already exists' };
    }
    
    const role = RoleRepository.create({
      role_name: data.role_name,
      permissions: data.permissions || [],
      pages: data.pages || [],
      is_active: data.is_active !== false
    });
    
    if (role) {
      // Automatic sync to Cloud
      handleSyncRolesToKV(token);
      return { success: true, role: role };
    }
    return { success: false, error: 'Failed to create role' };
  },

  updateRole(token, data) {
    const auth = requirePermission(token, 'write:users');
    if (!auth.success) return auth;
    
    if (!data.role_id) {
      return { success: false, error: 'Role ID is required' };
    }
    
    const role = RoleRepository.findById(data.role_id);
    if (!role) return { success: false, error: 'Role not found' };

    const updated = RoleRepository.update(data.role_id, {
      role_name: data.role_name,
      permissions: data.permissions,
      pages: data.pages,
      is_active: data.is_active
    });
    
    if (updated) {
      // Invalidate script cache for this role
      const cache = CacheService.getScriptCache();
      cache.remove('role_perms_' + role.role_name);
      if (data.role_name && data.role_name !== role.role_name) {
        cache.remove('role_perms_' + data.role_name);
      }

      handleSyncRolesToKV(token);
      return { success: true, message: 'Role updated successfully' };
    }
    return { success: false, error: 'Failed to update role' };
  },

  deleteRole(token, data) {
    const auth = requirePermission(token, 'write:users');
    if (!auth.success) return auth;
    
    if (!data.role_id) {
      return { success: false, error: 'Role ID is required' };
    }
    
    const role = RoleRepository.findById(data.role_id);
    if (!role) return { success: false, error: 'Role not found' };
    
    if (RoleRepository.isProtected(role.role_name)) {
      return { success: false, error: 'Cannot delete protected role' };
    }
    
    const deleted = RoleRepository.delete(data.role_id);
    if (deleted) {
      // Invalidate script cache
      CacheService.getScriptCache().remove('role_perms_' + role.role_name);
      
      handleSyncRolesToKV(token);
      return { success: true, message: 'Role deleted successfully' };
    }
    return { success: false, error: 'Failed to delete role' };
  },

  updateUserRole(token, data) {
    const auth = requirePermission(token, 'write:users');
    if (!auth.success) return auth;
    
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
    
    const updated = UserRepository.updateRole(data.user_id, data.role);
    
    if (updated) {
      // Invalidate all sessions for this user to force them to get a new JWT with the new role
      SessionRepository.deleteByUserId(data.user_id);
      
      return {
        success: true,
        message: 'User role updated and sessions invalidated',
        user: { id: data.user_id, role: data.role }
      };
    }
    return { success: false, error: 'Failed to update user role' };
  }
};
