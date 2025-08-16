import { requireGroup } from '../utils.js';
import { startAvd, stopAvd, getAvdStatus } from '../avd-functions.js'; // adjust import path

const ALLOWED_GROUPS = ["570fe125-3503-4277-8757-65f55a9ba35f"];

export default async function handler(req, res) {
  try {
    await requireGroup(req, ALLOWED_GROUPS);

    let result;
    switch (req.method.toUpperCase()) {
      case 'POST':
        if (req.url.endsWith('/start')) {
          result = await startAvd();
        } else if (req.url.endsWith('/stop')) {
          result = await stopAvd();
        } else {
          return res.status(400).json({ error: 'Invalid POST endpoint' });
        }
        break;
      case 'GET':
        if (req.url.endsWith('/status')) {
          result = await getAvdStatus();
        } else {
          return res.status(400).json({ error: 'Invalid GET endpoint' });
        }
        break;
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }

    res.status(200).json({ success: true, result });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message });
  }
}
