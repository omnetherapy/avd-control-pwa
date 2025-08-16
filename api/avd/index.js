// /api/avd/index.js
import { getClientPrincipal, extractGroupIdsFromPrincipal } from './utils.js';
import { startAvd, stopAvd, getAvdStatus } from './avdService.js';

// Replace with the Object IDs of your AVD groups in Azure AD
const GROUP_USERS  = '08160b89-cbf1-4e7b-bb51-f243c61e9cd0';
const GROUP_ADMINS = '570fe125-3503-4277-8757-65f55a9ba35f';

export default async function handler(req, res) {
  try {
    const principal = getClientPrincipal(req);
    if (!principal || !principal.userId) {
      return res.status(401).json({ error: 'Not logged in' });
    }

    const groupIds = extractGroupIdsFromPrincipal(principal);
    const isAdmin = groupIds.has(GROUP_ADMINS);
    const isUser  = groupIds.has(GROUP_USERS);

    const path = req.url.replace(/^\/api\/avd/, '').toLowerCase();

    if (path.startsWith('/start')) {
      if (!isUser && !isAdmin) return res.status(403).json({ error: 'Access denied' });
      const result = await startAvd();
      return res.status(200).json(result);
    }

    if (path.startsWith('/stop')) {
      if (!isAdmin) return res.status(403).json({ error: 'Only Administrators can stop VMs' });
      const result = await stopAvd();
      return res.status(200).json(result);
    }

    if (path.startsWith('/status')) {
      if (!isUser && !isAdmin) return res.status(403).json({ error: 'Access denied' });
      const result = await getAvdStatus();
      return res.status(200).json(result);
    }

    return res.status(404).json({ error: 'Unknown endpoint' });
  } catch (err) {
    console.error("AVD API error:", err);
    res.status(500).json({ error: err.message });
  }
}
