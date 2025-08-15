// /api/utils.js
const { ClientSecretCredential } = require("@azure/identity");
const axios = require("axios");

// ---- Settings ----
// Optional in-memory cache for Graph lookups (reduce latency/Graph calls)
const roleCache = {}; // userId -> { groups: Set<string>, exp: number }
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

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

/**
 * Extract group IDs from the client principal (if present).
 * SWA puts claims under principal.claims[] with typ/val pairs.
 */
function extractGroupIdsFromPrincipal(principal) {
  const out = new Set();
  if (!principal?.claims) return out;

  // Common group claim types
  const candidates = new Set([
    "groups",
    "http://schemas.microsoft.com/ws/2008/06/identity/claims/groups"
  ]);

  for (const c of principal.claims) {
    if (!c?.typ || !c?.val) continue;
    if (candidates.has(c.typ)) {
      // Single GUID per claim
      out.add(c.val);
    }
  }
  return out;
}

/**
 * Get all (transitive) groups from Microsoft Graph for the userId.
 * Uses client credential flow (App Registration).
 */
async function getUserGroupIdsFromGraph(userId) {
  // Cache check
  const hit = roleCache[userId];
  const now = Date.now();
  if (hit && hit.exp > now) return hit.groups;

  const { TENANT_ID, CLIENT_ID, CLIENT_SECRET } = process.env;
  if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET) {
    throw new Error("Missing TENANT_ID / CLIENT_ID / CLIENT_SECRET env vars.");
  }

  const cred = new ClientSecretCredential(TENANT_ID, CLIENT_ID, CLIENT_SECRET);
  const tokenResp = await cred.getToken("https://graph.microsoft.com/.default");
  if (!tokenResp?.token) throw new Error("Failed to acquire Graph token.");

  // POST getMemberObjects for transitive membership (includes nested groups)
  const url = `https://graph.microsoft.com/v1.0/users/${userId}/getMemberObjects`;
  const res = await axios.post(
    url,
    { securityEnabledOnly: false },
    { headers: { Authorization: `Bearer ${tokenResp.token}` }, timeout: 8000 }
  );

  const ids = new Set((res.data?.value || []).filter(Boolean));

  // Cache
  roleCache[userId] = { groups: ids, exp: now + CACHE_TTL_MS };
  return ids;
}

/**
 * Require membership in ANY of the allowedGroupIds.
 * 1) Try groups claim from x-ms-client-principal (fast)
 * 2) Fallback to Microsoft Graph (authoritative)
 */
async function requireGroup(req, allowedGroupIds = []) {
  const principal = getClientPrincipal(req);
  if (!principal || !principal.userId) {
    const err = new Error("Not logged in");
    err.status = 401;
    throw err;
  }
  if (!Array.isArray(allowedGroupIds) || allowedGroupIds.length === 0) {
    // If no group constraint supplied, only require authenticated
    return principal;
  }

  // 1) Check groups claim if present
  const claimGroups = extractGroupIdsFromPrincipal(principal);
  if (claimGroups.size > 0) {
    for (const g of allowedGroupIds) {
      if (claimGroups.has(g)) return principal;
    }
  }

  // 2) Fallback to Graph
  const graphGroups = await getUserGroupIdsFromGraph(principal.userId);
  for (const g of allowedGroupIds) {
    if (graphGroups.has(g)) return principal;
  }

  const err = new Error("Forbidden - insufficient group membership");
  err.status = 403;
  throw err;
}

module.exports = {
  getClientPrincipal,
  requireGroup,
  // exports below in case you want to unit test/log
  extractGroupIdsFromPrincipal,
  getUserGroupIdsFromGraph
};
