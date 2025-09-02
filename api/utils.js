// /api/avd/utils.js

/**
 * Decode the x-ms-client-principal header
 */
function getClientPrincipal(req) {
  const header = req.headers['x-ms-client-principal'];
  if (!header) return null;
  try {
    return JSON.parse(Buffer.from(header, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

/**
 * Pull out App Role values (e.g. "User","Admin","authenticated")
 */
function extractRoles(principal) {
  return new Set(
    Array.isArray(principal?.userRoles)
      ? principal.userRoles.map(r => r.toLowerCase())
      : []
  );
}

module.exports = { getClientPrincipal, extractRoles };
