function doGet(e) {
  const params = e.parameter;
  const action = params.action;
  
  try {
    let result;
    
    switch (action) {
      case 'verify':
        result = AuthHandler.verify(params.token);
        break;
      case 'getUsers':
        result = handleGetUsers(params.token, {});
        break;
      case 'getConfig':
        result = { success: true, config: ConfigService.getAll() };
        break;
      default:
        result = { success: false, error: 'Unknown action' };
    }
    
    return createJsonResponse(result);
      
  } catch (error) {
    return createJsonResponse({ success: false, error: error.message });
  }
}

function doPost(e) {
  const params = e.parameter;
  
  let postData;
  try {
    postData = JSON.parse(e.postData.contents);
  } catch (err) {
    postData = {};
  }
  
  const action = params.action || postData.action;
  const token = params.token || postData.token;
  
  try {
    let result;
    
    switch (action) {
      case 'register':
        result = AuthHandler.register(postData);
        break;
      case 'login':
        result = AuthHandler.login(postData);
        break;
      case 'logout':
        result = AuthHandler.logout(token);
        break;
      case 'verify':
        result = AuthHandler.verify(token);
        break;
      case 'getUsers':
        result = handleGetUsers(token, postData);
        break;
      case 'getRoles':
        result = RoleHandler.getRoles(token);
        break;
      case 'createRole':
        result = RoleHandler.createRole(token, postData);
        break;
      case 'updateRole':
        result = RoleHandler.updateRole(token, postData);
        break;
      case 'deleteRole':
        result = RoleHandler.deleteRole(token, postData);
        break;
      case 'updateUserRole':
        result = RoleHandler.updateUserRole(token, postData);
        break;
      case 'createUser':
        result = UserHandler.createUser(token, postData);
        break;
      case 'updateUser':
        result = UserHandler.updateUser(token, postData);
        break;
      case 'deleteUser':
        result = UserHandler.deleteUser(token, postData);
        break;
      default:
        result = { success: false, error: 'Unknown action' };
    }
    
    return createJsonResponse(result);
      
  } catch (error) {
    return createJsonResponse({ success: false, error: error.message });
  }
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleGetUsers(token, params) {
  if (!token) {
    return { success: false, error: 'Token is required' };
  }
  
  const session = SessionRepository.findByToken(token);
  if (!session || !Utils.isValidSession(session)) {
    return { success: false, error: 'Invalid or expired session' };
  }
  
  const user = UserRepository.findById(session[1]);
  if (!user || user.role !== 'admin') {
    return { success: false, error: 'Admin access required' };
  }
  
  const roles = RoleRepository.findAll();
  const rolesMap = {};
  roles.forEach(function(role) {
    rolesMap[role.role_name] = role;
  });
  
  const result = UserRepository.findAll({
    limit: params.limit ? parseInt(params.limit) : 0,
    offset: params.offset ? parseInt(params.offset) : 0
  });
  
  result.users = result.users.map(function(u) {
    if (rolesMap[u.role]) {
      u.role_details = rolesMap[u.role];
    }
    return u;
  });
  
  result.success = true;
  result.roles = roles;
  
  return result;
}
