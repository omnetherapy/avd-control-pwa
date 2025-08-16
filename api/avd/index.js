// /api/avd/index.js

import { getClientPrincipal } from "../utils.js";
import { startAvd, stopAvd, getAvdStatus } from "./avdService.js"; 

export default async function (req, res) {
  try {
    const principal = getClientPrincipal(req);
    if (!principal) return res.status(401).json({ error: "Not authenticated" });

    const roles = principal.userRoles || [];
    const path = req.url.toLowerCase(); // e.g. /api/avd/start

    // START VM
    if (path.includes("/start")) {
      if (!roles.includes("AVD_Users") && !roles.includes("AVD_Administrators")) {
        return res.status(403).json({ error: "Access denied" });
      }
      const result = await startAvd();
      return res.status(200).json({ success: true, result });
    }

    // STOP VM
    if (path.includes("/stop")) {
      if (!roles.includes("AVD_Administrators")) {
        return res.status(403).json({ error: "Only Administrators can stop VMs" });
      }
      const result = await stopAvd();
      return res.status(200).json({ success: true, result });
    }

    // STATUS
    if (path.includes("/status")) {
      if (!roles.includes("AVD_Users") && !roles.includes("AVD_Administrators")) {
        return res.status(403).json({ error: "Access denied" });
      }
      const result = await getAvdStatus();
      return res.status(200).json({ success: true, result });
    }

    // fallback
    return res.status(404).json({ error: "Unknown endpoint" });

  } catch (err) {
    console.error("AVD API error:", err);
    res.status(500).json({ error: err.message });
  }
}
