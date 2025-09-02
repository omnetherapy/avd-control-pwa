const { getClientPrincipal }            = require('./utils');
const { startAvd, stopAvd, getAvdStatus } = require('./avdService');

const ACTION_CONFIG = {
  start:  { methods: ['POST'] },
  stop:   { methods: ['POST'] },
  status: { methods: ['GET','POST'] }
};

function jsonResponse(ctx, status, body) {
  ctx.res = { status, headers: { 'Content-Type': 'application/json' }, body };
}

module.exports = async function (context, req) {
  context.log.info('AVD invoked', { method: req.method, url: req.url });

  // 1. Authenticate
  const principal = getClientPrincipal(req);
  if (!principal?.userId) {
    return jsonResponse(context, 401, { error: 'Not authenticated' });
  }

  // 2. Authorize by App Role *value* ("User" or "Admin")
  const roles   = Array.isArray(principal.userRoles) ? principal.userRoles : [];
  const isUser  = roles.includes('User');
  const isAdmin = roles.includes('Admin');

  // 3. Route dispatch
  const action = context.bindingData.path?.split('/')[0].toLowerCase() || '';
  const method = req.method.toUpperCase();

  if (!ACTION_CONFIG[action]) {
    return jsonResponse(context, 404, { error: 'Invalid endpoint' });
  }
  if (!ACTION_CONFIG[action].methods.includes(method)) {
    return jsonResponse(context, 405, {
      error: `Method Not Allowed. Allowed: ${ACTION_CONFIG[action].methods.join(', ')}`
    });
  }

  // 4. Execute
  try {
    let result;
    if (action === 'status') {
      if (!isUser && !isAdmin) {
        return jsonResponse(context, 403, { error: 'Access denied' });
      }
      result = await getAvdStatus();

    } else if (action === 'start') {
      if (!isUser && !isAdmin) {
        return jsonResponse(context, 403, { error: 'Access denied' });
      }
      result = await startAvd();

    } else { // stop
      if (!isAdmin) {
        return jsonResponse(context, 403, { error: 'Admins only' });
      }
      result = await stopAvd();
    }

    return jsonResponse(context, 200, { success: true, action, result });

  } catch (err) {
    context.log.error(err);
    return jsonResponse(context, 500, { error: err.message || 'Internal Server Error' });
  }
};
