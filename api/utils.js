// /api/utils.js
const { ClientSecretCredential } = require("@azure/identity");
const axios = require("axios");

// ---------- Config ----------
// Cache Graph lookups for 5 minutes to reduce latency and rate limiting.
const CACHE_TTL_MS = 5 * 60 * 1000;

// In-memory cache: userId -> { groups: Set<string>, exp: number }
const roleCache = Object.create(null);

// Reuse one credential instance across all functions (faster/cheaper).
const {
  TENANT_ID,
  CLIENT_ID,
  CLIENT_SECRET,
  AVD_USERS_GROUP_ID,
  AVD_ADMINISTRATORS_GROUP_ID,
} = process.env;

if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET) {
  // Don't throw at module load (breaks local builds), but log loudly.
  // Each call will still check and throw a nice message if missing.
  console.warn("[utils] Missing TENANT_ID / CLIENT_ID / CLIENT_SECRET env vars.");
}

const credential = (TENANT_ID && CLIENT_ID && CLIENT_SECRET)
  ? new ClientSecretCredential(TENANT_ID, CLIENT_ID, CLIENT_SECRET)
  : null;

// ---------- Helpers ----------

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

// Pull any group IDs that SWA might have put into claims (often empty on Free).
function extractGroupIdsFromPrincipal(principal) {
  const out = new Set();
  const claims = principal?.claims || [];
  const groupTyp = new Set([
    "groups",
    "http://schemas.microsoft.com/ws/2008/06/identity/claims/groups",
  ]);

  for (const c of claims) {
    if (c?.typ && c?.val && groupTyp.has(c.typ)) out.add(c.val);
  }
  return out;
}

// Ensure we have a user Object ID. If principal.userId is not a GUID, resolve via UPN.
const GUID_RE = /^[0-9a-fA-F-]{36}$/;
async function resolveUserObjectId(principal) {
  if (!principal?.userId) return null;
  if (GUID_RE.test(principal.userId)) return principal.userId;

  // Fallback: try userDetails (UPN/email) -> /users/{id-or-upn}?$select=id
  const upn = principal.userDetails;
  if (!upn) return principal.userId; // best effort

  const token = await getGraphToken();
  const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(upn)}?$select=id`;
  try {
    const res = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 6000,
    });
    return res.data?.id || principal.userId;
  } catch {
    return principal.userId; // best effort fallback
  }
}

async function getGraphToken() {
  if (!credential) {
    throw new Error("Server misconfiguration: missing TENANT_ID / CLIENT_ID / CLIENT_SECRET.");
  }
  const t = await credential.getToken("https://graph.microsoft.com/.default");
  if (!t?.token) throw new Error("Failed to acquire Microsoft Graph token.");
  return t.token;
}

// Call /users/{id}/getMemberObjects for transitive group IDs with retry on 429/503.
async function getUserGroupIdsFromGraph(userObjectId) {
  const now = Date.now();
  const cached = roleCache[userObjectId];
  if (cached && cached.exp > now) return cached.groups;

  const token = await getGraphToken();
  const url = `https://graph.microsoft.com/v1.0/users/${userObjectId}/getMemberObjects`;
  const body = { securityEnabledOnly: false };

  let attempt = 0;
  let lastErr;
  while (attempt < 3) {
    try {
      const res = await axios.post(url, body, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 8000,
      });
      const ids = new Set((res.data?.value || []).filter(Boolean));
      roleCache[userObjectId] = { groups: ids, exp: now + CACHE_TTL_MS };
      return ids;
    } catch (err) {
      lastErr = err;
      const status = err?.response?.status;
      if (status === 429 || status === 503) {
        // Backoff: 400ms, 800ms, 1600ms
        const wait = 400 * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, wait));
        attempt++;
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

/**
 * requireGroup(req, [groupId1, groupId2, ...])
 * Pass the **OBJECT IDs** of "AVD Users" and/or "AVD Administrators".
 * Returns the principal if authorized; throws 401/403 otherwise.
 */
async function requireGroup(req, allowedGroupIds = []) {
  const principal = getClientPrincipal(req);
  if (!principal) {
    const err = new Error("Not logged in");
    err.status = 401;
    throw err;
  }
  if (!Array.isArray(allowedGroupIds) || allowedGroupIds.length === 0) {
    // If you call requireGroup with no groups, it only asserts "authenticated".
    return principal;
  }

  // Fast path: if SWA included group claims (sometimes on Free), accept them.
  const claimGroups = extractGroupIdsFromPrincipal(principal);
  for (const g of allowedGroupIds) {
    if (claimGroups.has(g)) return principal;
  }

  // Authoritative path: resolve ObjectId, then query Graph for group memberships.
  const userObjectId = await resolveUserObjectId(principal);
  const graphGroups = await getUserGroupIdsFromGraph(userObjectId);
  for (const g of allowedGroupIds) {
    if (graphGroups.has(g)) return principal;
  }

  const err = new Error("Forbidden - insufficient group membership");
  err.status = 403;
  throw err;
}

function getConfiguredGroupIds() {
  return {
    users: AVD_USERS_GROUP_ID,
    admins: AVD_ADMINISTRATORS_GROUP_ID,
  };
}

module.exports = {
  getClientPrincipal,
  requireGroup,
  getConfiguredGroupIds,
  // Expose helpers if you want to test/log later
  extractGroupIdsFromPrincipal,
  getUserGroupIdsFromGraph,
  resolveUserObjectId,
};
