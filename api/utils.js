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

function extractGroupIdsFromPrincipal(principal) {
  const claims = principal.userClaims || principal.claims || [];
  return new Set(
    claims
      .filter(c => c.typ === 'groups' || c.type === 'groups')
      .map(c => c.val || c.value)
  );
}

module.exports = { getClientPrincipal, extractGroupIdsFromPrincipal };
