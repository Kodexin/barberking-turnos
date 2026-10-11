// Middleware del Módulo de Autenticación: valida el token JWT y, opcionalmente,
// restringe el acceso por rol (cliente / barbero / administrador), tal como lo
// exige RNF04 (proteger datos personales mediante autenticación).
const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "No se envió token de autenticación." });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = payload; // { id, rol, nombre }
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token inválido o expirado." });
  }
}

function requireRol(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario || !rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({ error: "No tienes permiso para realizar esta acción." });
    }
    next();
  };
}

module.exports = { requireAuth, requireRol };
