import jwt from "jsonwebtoken";

/**
 * JWT-auth middleware voor Express.
 * - Vereist een geldige Bearer token in Authorization header.
 * - Zet decoded user-info als req.user voor RBAC en tenant checks.
 * - Bij ontbreken of ongeldige token: 401.
 */
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader && authHeader.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : null;

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
