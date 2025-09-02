// /api/avd/utils.js

/**
 * Decode the x-ms-client-principal header into a JSON object
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
 * Return a Set of lower-cased App Role values (e.g. "user","admin")
 */
function extractRoles(principal) {
  return new Set(
    Array.isArray(principal?.userRoles)
      ? principal.userRoles.map(r => r.toLowerCase())
      : []
  );
}

module.exports = { getClientPrincipal, extractRoles };
