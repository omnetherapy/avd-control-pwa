const { getClientPrincipal, extractGroupIdsFromPrincipal } = require('./utils');
const { startAvd, stopAvd, getAvdStatus } = require('./avdService');

const roles   = principal.userRoles || [];
const isAdmin = roles.includes('Admin');
const isUser  = roles.includes('User');

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

  // 1) Authenticate
  const principal = getClientPrincipal(req);
  if (!principal?.userId) {
    return jsonResponse(context, 401, { error: 'Not authenticated' });
  }

  // 2) Authorize
  const groups  = extractGroupIdsFromPrincipal(principal);
  const isAdmin = groups.has(ADMIN_GROUP_ID);
  const isUser  = groups.has(USERS_GROUP_ID);

  // 3) Determine action
  const path   = context.bindingData.path?.split('/')[0]?.toLowerCase() || '';
  const method = req.method.toUpperCase();
  if (!ACTION_CONFIG[path]) {
    return jsonResponse(context, 404, { error: 'Invalid endpoint' });
  }
  if (!ACTION_CONFIG[path].methods.includes(method)) {
    return jsonResponse(context, 405, {
      error: `Method Not Allowed. Allowed: ${ACTION_CONFIG[path].methods.join(', ')}`
    });
  }

  // 4) Execute
  try {
    let result;
    if (path === 'start') {
      if (!isUser && !isAdmin) return jsonResponse(context, 403, { error: 'Access denied' });
      result = await startAvd();
    } else if (path === 'stop') {
      if (!isAdmin) return jsonResponse(context, 403, { error: 'Admins only' });
      result = await stopAvd();
    } else { // status
      if (!isUser && !isAdmin) return jsonResponse(context, 403, { error: 'Access denied' });
      result = await getAvdStatus();
    }
    return jsonResponse(context, 200, { success: true, action: path, result });
  } catch (e) {
    context.log.error(e);
    return jsonResponse(context, 500, { error: e.message || 'Internal Server Error' });
  }
};
