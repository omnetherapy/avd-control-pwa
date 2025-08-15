// utils.js — shared authentication & role helpers

function getClientPrincipal(req) {
  const b64 = req.headers["x-ms-client-principal"];
  if (!b64) return null;
  try {
    const json = Buffer.from(b64, "base64").toString("utf8");
    const p = JSON.parse(json);
    p.userRoles = Array.isArray(p.userRoles) ? p.userRoles : [];
    return p;
  } catch {
    return null;
  }
}

function requireRole(context, req, allowedRoles) {
  const principal = getClientPrincipal(req);
  if (!principal) {
    context.res = { status: 401, body: { success: false, error: "Not authenticated" } };
    return null;
  }
  const ok = principal.userRoles.some(r => allowedRoles.includes(r));
  if (!ok) {
    context.res = { status: 403, body: { success: false, error: "Forbidden" } };
    return null;
  }
  return principal;
}

module.exports = { getClientPrincipal, requireRole };
