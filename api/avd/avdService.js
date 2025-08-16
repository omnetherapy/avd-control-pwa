import { getClientPrincipal, extractGroupIdsFromPrincipal } from './utils.js';
import { startAvd, stopAvd, getAvdStatus } from './avdService.js';

// Define allowed group/role names
const USERS_GROUP = 'AVD_Users';
const ADMIN_GROUP = 'AVD_Administrators';

export default async function handler(req, res) {
  try {
    // Get authenticated user
    const principal = getClientPrincipal(req);
    if (!principal || !principal.userId) {
      return res.status(401).json({ error: 'Not logged in' });
    }

    const groups = extractGroupIdsFromPrincipal(principal);

    // Route based on request path
    const path = req.url.replace(/^\/api\/avd/, '').toLowerCase();

    if (path.startsWith('/start')) {
      // Allow both users and admins to start
      if (!groups.has(USERS_GROUP) && !groups.has(ADMIN_GROUP)) {
        return res.status(403).json({ error: 'Access denied' });
      }
      const result = await startAvd();
      return res.status(200).json(result);
    }

    if (path.startsWith('/stop')) {
      // Only admins can stop
      if (!groups.has(ADMIN_GROUP)) {
        return res.status(403).json({ error: 'Access denied' });
      }
      const result = await stopAvd();
      return res.status(200).json(result);
    }

    if (path.startsWith('/status')) {
      // Allow both users and admins to check status
      if (!groups.has(USERS_GROUP) && !groups.has(ADMIN_GROUP)) {
        return res.status(403).json({ error: 'Access denied' });
      }
      const result = await getAvdStatus();
      return res.status(200).json(result);
    }

    // Unknown path
    return res.status(404).json({ error: 'Invalid endpoint' });

  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message });
  }
}
