// util.js

/**
 * Decode the x-ms-client-principal header into a JSON object
 */
function getClientPrincipal(req) {
  const header = req.headers['x-ms-client-principal'];
  if (!header) return null;

  try {
    const decoded = Buffer.from(header, 'base64').toString('utf8');
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

/**
 * Extract App Role values (e.g. "User", "Admin") into a Set
 */
function extractRoles(principal) {
  const roles = Array.isArray(principal?.userRoles)
    ? principal.userRoles
    : [];

  return new Set(roles);
}

module.exports = {
  getClientPrincipal,
  extractRoles
};
