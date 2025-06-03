export function requireRole(roles, opts = {}) {
  return function (req, res, next) {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Not authenticated" });
    if (!roles.includes(user.role)) return res.status(403).json({ error: "Forbidden: insufficient role" });

    if (opts.onlyOwnTenant && user.role !== "superadmin") {
      const reqTenantId =
        req.params.tenantId ||
        req.params.tenant_id ||
        req.body.tenant_id ||
        req.query.tenant_id;
      if (reqTenantId && reqTenantId !== user.tenant_id) {
        return res.status(403).json({ error: "Forbidden: wrong tenant" });
      }
    }

    if (opts.allowSelf && req.params.id && req.params.id === user.id) {
      return next();
    }
    next();
  };
}
