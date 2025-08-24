/**
 * Autorisatie op basis van req.user.role (gezet door requireAuth).
 * Voorbeeld: router.post('/x', requireAuth, requireRole(['manager','superadmin']), handler)
 */
export function requireRole(allowed = []) {
  return (req, res, next) => {
    try {
      const role = req.user?.role || 'support';
      if (!allowed.includes(role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      next();
    } catch {
      return res.status(403).json({ error: 'Forbidden' });
    }
  };
}
