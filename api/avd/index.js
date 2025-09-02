// /api/avd/index.js
const { getClientPrincipal, extractRoles } = require('./utils');
const { startAvd, stopAvd, getAvdStatus } = require('./avdService');

const ACTION_CONFIG = {
  start:  { methods: ['POST'] },
  stop:   { methods: ['POST'] },
  status: { methods: ['GET','POST'] }
};

module.exports = async function (context, req) {
  // 1) Authenticate
  const principal = getClientPrincipal(req);
  if (!principal?.userId) {
    return {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
      body: { error: 'Not authenticated' }
    };
  }

  // 2) Authorize
  const roles   = extractRoles(principal);
  const isUser  = roles.has('user');
  const isAdmin = roles.has('admin');

  // 3) Validate action + method
  const action = (context.bindingData.path || '').split('/')[0].toLowerCase();
  const method = req.method.toUpperCase();
  const cfg    = ACTION_CONFIG[action];
  if (!cfg) {
    return { status: 404, headers: { 'Content-Type': 'application/json' },
             body: { error: 'Invalid endpoint' } };
  }
  if (!cfg.methods.includes(method)) {
    return { status: 405, headers: { 'Content-Type': 'application/json' },
             body: { error: `Allowed: ${cfg.methods.join(', ')}` } };
  }

  // 4) Execute and return
  try {
    let result;
    if (action === 'status') {
      if (!isUser && !isAdmin) {
        return { status: 403, headers: { 'Content-Type': 'application/json' },
                 body: { error: 'Access denied' } };
      }
      result = await getAvdStatus();

    } else if (action === 'start') {
      if (!isUser && !isAdmin) {
        return { status: 403, headers: { 'Content-Type': 'application/json' },
                 body: { error: 'Access denied' } };
      }
      result = await startAvd();

    } else { // stop
      if (!isAdmin) {
        return { status: 403, headers: { 'Content-Type': 'application/json' },
                 body: { error: 'Admins only' } };
      }
      result = await stopAvd();
    }

    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: { success: true, action, result }
    };

  } catch (err) {
    context.log.error(err);
    return {
      status: 500,
      // In /api/avd/index.js, inside your catch:
return {
  status: 500,
  headers: { 'Content-Type': 'application/json' },
  body: { 
    error: err.message || 'Internal Server Error',
    stack: err.stack
  }
};
}
    };
  }
};
