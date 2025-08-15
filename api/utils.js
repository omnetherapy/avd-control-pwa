// utils.js
const { ClientSecretCredential } = require("@azure/identity");
const axios = require("axios");

// Replace with your Azure AD group Object IDs
const GROUPS = {
  USERS: "570fe125-3503-4277-8757-65f55a9ba35f",
  ADMINS: "08160b89-cbf1-4e7b-bb51-f243c61e9cd0"
};

// --- In-memory cache: { userId: { roles: [], expires: timestamp } }
const roleCache = {};
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getClientPrincipal(req) {
  const header = req.headers["x-ms-client-principal"];
  if (!header) return null;
  try {
    const decoded = Buffer.from(header, "base64").toString("utf8");
    const principal = JSON.parse(decoded);
    principal.userRoles = principal.userRoles || [];
    return principal;
  } catch {
    return null;
  }
}

async function getUserGroups(userId) {
  const { TENANT_ID, CLIENT_ID, CLIENT_SECRET } = process.env;
  if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET) {
    throw new Error("Missing TENANT_ID, CLIENT_ID, or CLIENT_SECRET in environment variables.");
  }

  const credential = new ClientSecretCredential(TENANT_ID, CLIENT_ID, CLIENT_SECRET);
  const tokenResponse = await credential.getToken("https://graph.microsoft.com/.default");

  const url = `https://graph.microsoft.com/v1.0/users/${userId}/memberOf?$select=id`;
  const res = await axios.get(url, {
    headers: { Authorization: `Bearer ${tokenResponse.token}` },
    timeout: 5000
  });

  return res.data.value.map(g => g.id);
}

async function getUserRoles(userId) {
  // 1. Check cache first
  const cached = roleCache[userId];
  const now = Date.now();
  if (cached && cached.expires > now) {
    return cached.roles;
  }

  // 2. Get groups from Microsoft Graph
  const groups = await getUserGroups(userId);

  // 3. Map group IDs to application roles
  const roles = [];
  if (groups.includes(GROUPS.USERS)) roles.push("AVD_Users");
  if (groups.includes(GROUPS.ADMINS)) roles.push("AVD_Administrators");

  // 4. Save to cache
  roleCache[userId] = {
    roles,
    expires: now + CACHE_TTL_MS
  };

  return roles;
}

async function requireRole(req, allowedRoles) {
  const principal = getClientPrincipal(req);
  if (!principal || !principal.userId) {
    throw new Error("No authenticated user found.");
  }

  const userRoles = await getUserRoles(principal.userId);
  if (!allowedRoles.some(r => userRoles.includes(r))) {
    throw new Error("Unauthorized: missing required role.");
  }

  return { principal, userRoles };
}

module.exports = {
  getClientPrincipal,
  getUserRoles,
  requireRole
};
