// /api/avd/utils.js

/**
 * Reads the Static Web App client principal from request headers.
 * Returns null if not authenticated.
 */
export function getClientPrincipal(req) {
  try {
    const header = req.headers['x-ms-client-principal'];
    if (!header) return null;

    // Decode Base64 JSON
    const encoded = Buffer.from(header, 'base64').toString('ascii');
    const principal = JSON.parse(encoded);
    return principal;
  } catch (err) {
    console.error("Failed to parse client principal:", err);
    return null;
  }
}

/**
 * Returns a Set of Azure AD group Object IDs the user is in.
 */
export function extractGroupIdsFromPrincipal(principal) {
  if (!principal || !principal.userClaims) return new Set();

  const groupIds = principal.userClaims
    .filter(c => c.typ === 'groups')
    .map(c => c.val);

  return new Set(groupIds);
}
