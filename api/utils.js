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

function extractGroupIdsFromPrincipal(principal) {
  const out = new Set();
  if (!principal?.claims) return out;

  const candidates = new Set([
    "groups",
    "http://schemas.microsoft.com/ws/2008/06/identity/claims/groups"
  ]);

  for (const c of principal.claims) {
    if (!c?.typ || !c?.val) continue;
    if (candidates.has(c.typ)) {
      out.add(c.val);
    }
  }
  return out;
}

async function requireGroup(req, allowedGroupIds = []) {
  const principal = getClientPrincipal(req);
  if (!principal || !principal.userId) {
    const err = new Error("Not logged in");
    err.status = 401;
    throw err;
  }
  if (!Array.isArray(allowedGroupIds) || allowedGroupIds.length === 0) {
    return principal; // just authenticated
  }

  const claimGroups = extractGroupIdsFromPrincipal(principal);
  for (const g of allowedGroupIds) {
    if (claimGroups.has(g)) return principal;
  }

  const err = new Error("Forbidden - insufficient group membership");
  err.status = 403;
  throw err;
}

module.exports = {
  getClientPrincipal,
  requireGroup
};
