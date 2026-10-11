// Catálogo de servicios: cada uno con su duración (define el bloque de agenda) y precio.
const express = require("express");
const db = require("../db");
const { requireAuth, requireRol } = require("../middleware/auth");

const router = express.Router();

router.get("/", (req, res) => {
  const servicios = db
    .prepare("SELECT id, nombre, duracion_min, precio FROM servicios WHERE activo = 1 ORDER BY nombre")
    .all();
  res.json(servicios);
});

// Solo el administrador gestiona el catálogo (alta de nuevos servicios).
router.post("/", requireAuth, requireRol("administrador"), (req, res) => {
  const { nombre, duracion_min, precio } = req.body;
  if (!nombre || !duracion_min || duracion_min <= 0 || precio == null || precio < 0) {
    return res.status(400).json({ error: "nombre, duracion_min (>0) y precio (>=0) son obligatorios." });
  }
  const info = db
    .prepare("INSERT INTO servicios (nombre, duracion_min, precio) VALUES (?,?,?)")
    .run(nombre, duracion_min, precio);
  res.status(201).json({ id: info.lastInsertRowid, nombre, duracion_min, precio });
});

router.patch("/:id/desactivar", requireAuth, requireRol("administrador"), (req, res) => {
  db.prepare("UPDATE servicios SET activo = 0 WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
