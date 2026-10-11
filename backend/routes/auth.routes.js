// Módulo de Autenticación (RF01): registro e inicio de sesión de
// cliente, barbero y administrador.
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");
const { requireAuth, requireRol } = require("../middleware/auth");

const router = express.Router();
const ROLES_VALIDOS = ["cliente", "barbero", "administrador"];

router.post("/registro", (req, res) => {
  const { nombre, email, password, rol } = req.body;

  if (!nombre || !email || !password) {
    return res.status(400).json({ error: "Nombre, correo y contraseña son obligatorios." });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres." });
  }
  // Por seguridad, el registro público solo permite crear clientes.
  // Barberos y administradores se crean desde el panel de administración (ver /usuarios).
  const rolFinal = rol === "cliente" || !rol ? "cliente" : null;
  if (!rolFinal) {
    return res.status(400).json({ error: "El registro público solo está disponible para clientes." });
  }

  const existente = db.prepare("SELECT id FROM usuarios WHERE email = ?").get(email);
  if (existente) {
    return res.status(409).json({ error: "Ya existe una cuenta con ese correo." });
  }

  const hash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare("INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES (?,?,?,?)")
    .run(nombre, email, hash, rolFinal);

  const token = jwt.sign(
    { id: info.lastInsertRowid, nombre, rol: rolFinal },
    process.env.JWT_SECRET,
    { expiresIn: "12h" }
  );
  res.status(201).json({ token, usuario: { id: info.lastInsertRowid, nombre, email, rol: rolFinal } });
});

router.post("/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Correo y contraseña son obligatorios." });
  }

  const usuario = db.prepare("SELECT * FROM usuarios WHERE email = ?").get(email);
  if (!usuario || !bcrypt.compareSync(password, usuario.password_hash)) {
    return res.status(401).json({ error: "Correo o contraseña incorrectos." });
  }

  const token = jwt.sign(
    { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol },
    process.env.JWT_SECRET,
    { expiresIn: "12h" }
  );
  res.json({
    token,
    usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol },
  });
});

// Administración de usuarios (crear barberos, listar barberos para el selector del cliente).
router.get("/barberos", (req, res) => {
  const barberos = db
    .prepare("SELECT id, nombre FROM usuarios WHERE rol = 'barbero' ORDER BY nombre")
    .all();
  res.json(barberos);
});

// Solo el administrador puede dar de alta barberos u otros administradores.
router.post("/usuarios", requireAuth, requireRol("administrador"), (req, res) => {
  const { nombre, email, password, rol } = req.body;
  if (!nombre || !email || !password || !ROLES_VALIDOS.includes(rol)) {
    return res.status(400).json({ error: "Datos inválidos. rol debe ser cliente, barbero o administrador." });
  }
  const existente = db.prepare("SELECT id FROM usuarios WHERE email = ?").get(email);
  if (existente) {
    return res.status(409).json({ error: "Ya existe una cuenta con ese correo." });
  }
  const hash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare("INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES (?,?,?,?)")
    .run(nombre, email, hash, rol);
  res.status(201).json({ id: info.lastInsertRowid, nombre, email, rol });
});

module.exports = { router, ROLES_VALIDOS };
