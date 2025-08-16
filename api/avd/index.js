import { getClientPrincipal } from './utils.js';
import { startAvd, stopAvd, getAvdStatus } from './avdService.js';

// Replace with your actual Azure AD Group Object IDs
const GROUP_ADMINS = "08160b89-cbf1-4e7b-bb51-f243c61e9cd0";
const GROUP_USERS  = "570fe125-3503-4277-8757-65f55a9ba35f";

export default async function handler(req, res) {
  try {
    const principal = getClientPrincipal(req);
    if (!principal || !principal.userId) {
      return res.status(401).json({ error: 'Not logged in' });
    }

    const claims = principal.userClaims || [];
    const groupIds = claims.filter(c => c.typ === "groups").map(c => c.val);
    const isAdmin = groupIds.includes(GROUP_ADMINS);
    const isUser  = groupIds.includes(GROUP_USERS);

    const path = req.url.replace(/^\/api\/avd/, '').toLowerCase();

    // Start VM
    if (path.startsWith('/start')) {
      if (!(isUser || isAdmin)) return res.status(403).json({ error: 'Access denied' });
      const result = await startAvd();
      return res.status(200).json(result);
    }

    // Stop VM
    if (path.startsWith('/stop')) {
      if (!isAdmin) return res.status(403).json({ error: 'Access denied' });
      const result = await stopAvd();
      return res.status(200).json(result);
    }

    // Status
    if (path.startsWith('/status')) {
      if (!(isUser || isAdmin)) return res.status(403).json({ error: 'Access denied' });
      const result = await getAvdStatus();
      return res.status(200).json(result);
    }

    return res.status(404).json({ error: 'Invalid endpoint' });

  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message });
  }
}
