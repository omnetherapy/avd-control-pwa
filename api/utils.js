export function getClientPrincipal(req) {
  const header = req.headers['x-ms-client-principal'];
  if (!header) return null;
  const encoded = Buffer.from(header, 'base64').toString('ascii');
  return JSON.parse(encoded);
}

// Convert user claims/groups into a Set of object IDs
export function extractGroupIdsFromPrincipal(principal) {
  const claims = principal.userClaims || [];
  const groups = claims
    .filter(c => c.typ === 'groups')
    .map(c => c.val);
  return new Set(groups);
}
