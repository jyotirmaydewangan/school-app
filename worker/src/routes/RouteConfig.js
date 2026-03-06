export const RouteConfig = {
  parsePath(pathname) {
    let action = pathname.replace('/api/', '');
    if (action.startsWith('/')) {
      action = action.substring(1);
    }
    return action;
  },

  parseMethod(method) {
    return method.toUpperCase();
  },

  shouldHandle(method) {
    return ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'].includes(method.toUpperCase());
  },

  isGetRequest(method) {
    return method.toUpperCase() === 'GET';
  },

  isWriteRequest(method) {
    return ['POST', 'PUT', 'DELETE'].includes(method.toUpperCase());
  }
};

export const RequestParser = {
  async parseBody(request) {
    const contentType = request.headers.get('Content-Type') || '';

    try {
      if (contentType.includes('application/json')) {
        return await request.clone().text();
      }

      if (contentType.includes('application/x-www-form-urlencoded') ||
        contentType.includes('multipart/form-data')) {
        const formData = await request.clone().formData();
        return JSON.stringify(Object.fromEntries(formData));
      }
    } catch (e) {
      console.error(`Error parsing body: ${e.message}`);
    }

    return null;
  },

  buildApiUrl(scriptUrl, action, queryParams) {
    const separator = scriptUrl.includes('?') ? '&' : '?';
    const params = new URLSearchParams();
    params.set('action', action);

    if (queryParams instanceof URLSearchParams) {
      queryParams.forEach((value, key) => {
        if (key !== 'action') params.set(key, value);
      });
    } else if (queryParams && typeof queryParams === 'object') {
      for (const [key, value] of Object.entries(queryParams)) {
        if (key !== 'action' && value !== undefined && value !== null) {
          params.set(key, String(value));
        }
      }
    }

    return `${scriptUrl}${separator}${params.toString()}`;
  }
};
