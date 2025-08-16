// /api/avd/utils.js

/**
 * Read the x-ms-client-principal header that Static Web Apps injects.
 * Returns parsed principal object or null.
 *
 * Typical structure (example):
 * {
 *   "identityProvider":"aad",
 *   "userId":"....",
 *   "userDetails":"user@contoso.com",
 *   "userRoles": [...],
 *   "userClaims":[ { "typ":"name","val":"..." }, { "typ":"groups","val":"<group-guid>" }, ... ]
 * }
 */
export function getClientPrincipal(req) {
  try {
    if (!req || !req.headers) return null;
    // header keys are usually lowercase in Node
    const header = req.headers['x-ms-client-principal'] || req.headers['X-MS-CLIENT-PRINCIPAL'];
    if (!header) return null;
    // header is base64-encoded JSON
    const decoded = Buffer.from(header, 'base64').toString('utf8');
    const principal = JSON.parse(decoded);
    return principal;
  } catch (err) {
    // don't throw — caller will treat as unauthenticated
    console.error('getClientPrincipal: failed to parse principal', err && err.message);
    return null;
  }
}

/**
 * Return a Set of group object IDs (strings) found in the principal.
 * Accepts principal.userClaims or principal.claims depending on token shape.
 */
export function extractGroupIdsFromPrincipal(principal) {
  if (!principal) return new Set();
  const claims = principal.userClaims || principal.claims || [];
  const groupVals = claims
    .filter(c => c && (c.typ === 'groups' || c.type === 'groups'))
    .map(c => c.val || c.value)
    .filter(Boolean);
  return new Set(groupVals);
}
