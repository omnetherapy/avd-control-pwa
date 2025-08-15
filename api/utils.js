// /api/utils.js
function getClientPrincipal(req) {
  const hdr = req.headers["x-ms-client-principal"];
  if (!hdr) return null;
  try {
    const decoded = Buffer.from(hdr, "base64").toString("utf8");
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

async function requireRole(req, allowedRoles) {
  const principal = getClientPrincipal(req);
  if (!principal) {
    const err = new Error("Not logged in");
    err.status = 401;
    throw err;
  }
  const roles = principal.userRoles || [];
  const ok = allowedRoles.some(r => roles.includes(r));
  if (!ok) {
    const err = new Error("Forbidden - insufficient role");
    err.status = 403;
    throw err;
  }
  return principal;
}

module.exports = { getClientPrincipal, requireRole };
