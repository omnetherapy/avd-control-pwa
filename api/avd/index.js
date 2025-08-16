// /api/avd/index.js
import { getClientPrincipal, extractGroupIdsFromPrincipal } from './utils.js';
import { startAvd, stopAvd, getAvdStatus } from './avdService.js';

// 🔧 Replace these with the actual Azure AD Group Object IDs (GUID strings)
const USERS_GROUP_ID  = '570fe125-3503-4277-8757-65f55a9ba35f'; // example: AVD Users
const ADMIN_GROUP_ID  = '08160b89-cbf1-4e7b-bb51-f243c61e9cd0'; // example: AVD Administrators

// Allowed HTTP methods by action
const ACTION_CONFIG = {
  start: { methods: ['POST'] },
  stop:  { methods: ['POST'] },
  status:{ methods: ['GET','POST'] } // status supports GET (and POST for convenience)
};

// Helper to return consistent JSON responses
function jsonResponse(context, status, body) {
  context.res = { status, headers: { 'Content-Type': 'application/json' }, body };
}

export default async function (context, req) {
  try {
    context.log.info('AVD function invoked', { method: req?.method, url: req?.url });

    // Decode principal
    const principal = getClientPrincipal(req);
    if (!principal || !principal.userId) {
      context.log.warn('Unauthenticated request');
      return jsonResponse(context, 401, { error: 'Not authenticated' });
    }

    // Extract group object IDs as a Set
    const groupSet = extractGroupIdsFromPrincipal(principal);
    const isAdmin = groupSet.has(ADMIN_GROUP_ID);
    const isUser  = groupSet.has(USERS_GROUP_ID);

    context.log.info('Principal groups', { isAdmin, isUser, userId: principal.userId });

    // Determine action (prefer bindingData.path)
    let action = '';
    if (context.bindingData && typeof context.bindingData.path === 'string') {
      action = context.bindingData.path.split('/').filter(Boolean)[0]?.toLowerCase() || '';
    } else {
      // Fallback: parse from URL
      const m = (req?.url || '').match(/\/api\/avd\/([^\/\?\#]+)/i);
      action = (m && m[1]) ? m[1].toLowerCase() : '';
    }

    context.log.info('Resolved action', { action });

    // Validate action
    if (!['start','stop','status'].includes(action)) {
      return jsonResponse(context, 404, { error: 'Invalid endpoint' });
    }

    // Method validation
    const allowedMethods = ACTION_CONFIG[action].methods;
    const method = (req.method || 'GET').toUpperCase();
    if (!allowedMethods.includes(method)) {
      return jsonResponse(context, 405, { error: `Method Not Allowed. Allowed: ${allowedMethods.join(', ')}` });
    }

    // Authorization checks (group-based)
    if (action === 'start') {
      if (!isUser && !isAdmin) return jsonResponse(context, 403, { error: 'Access denied' });
      const result = await startAvd();
      return jsonResponse(context, 200, { success: true, action: 'start', result });
    }

    if (action === 'stop') {
      if (!isAdmin) return jsonResponse(context, 403, { error: 'Only administrators may stop VMs' });
      const result = await stopAvd();
      return jsonResponse(context, 200, { success: true, action: 'stop', result });
    }

    if (action === 'status') {
      if (!isUser && !isAdmin) return jsonResponse(context, 403, { error: 'Access denied' });
      const result = await getAvdStatus();
      return jsonResponse(context, 200, { success: true, action: 'status', result });
    }

    // Fallback (shouldn't be reached)
    return jsonResponse(context, 400, { error: 'Bad request' });

  } catch (err) {
    // Log error server-side (do not expose secrets)
    context.log.error('AVD API error', err && (err.message || err));
    const safeMessage = err && err.message ? err.message : 'Internal Server Error';
    return jsonResponse(context, err.status || 500, { error: safeMessage });
  }
}

export default async function handler(req, res) {
  try {
    const principal = getClientPrincipal(req);
    if (!principal || !principal.userId) {
      return res.status(401).json({ error: 'Not logged in' });
    }

    // extract the user's group object IDs
    const groups = extractGroupIdsFromPrincipal(principal);

    // route
    const path = req.url.replace(/^\/api\/avd/, '').toLowerCase();

    if (path.startsWith('/start')) {
      if (!groups.has(USERS_GROUP_ID) && !groups.has(ADMIN_GROUP_ID)) {
        return res.status(403).json({ error: 'Access denied' });
      }
      const result = await startAvd();
      return res.status(200).json(result);
    }

    if (path.startsWith('/stop')) {
      if (!groups.has(ADMIN_GROUP_ID)) {
        return res.status(403).json({ error: 'Access denied' });
      }
      const result = await stopAvd();
      return res.status(200).json(result);
    }

    if (path.startsWith('/status')) {
      if (!groups.has(USERS_GROUP_ID) && !groups.has(ADMIN_GROUP_ID)) {
        return res.status(403).json({ error: 'Access denied' });
      }
      const result = await getAvdStatus();
      return res.status(200).json(result);
    }

    return res.status(404).json({ error: 'Invalid endpoint' });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message });
  }
}
