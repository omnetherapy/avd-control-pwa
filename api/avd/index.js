import { getClientPrincipal, extractGroupIdsFromPrincipal } from './utils.js';
import { startAvd, stopAvd, getAvdStatus } from './avdService.js';

// 🔧 Replace with your Azure AD group object IDs
const USERS_GROUP_ID = '570fe125-3503-4277-8757-65f55a9ba35f'; // AVD Users object ID
const ADMIN_GROUP_ID = '08160b89-cbf1-4e7b-bb51-f243c61e9cd0'; // AVD Administrators object ID

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
