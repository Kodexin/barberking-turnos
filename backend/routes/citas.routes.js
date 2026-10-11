// Módulo de Reservas y Agenda (RF02, RF03) + disparo del Módulo de Notificaciones (RF04).
const express = require("express");
const db = require("../db");
const { requireAuth, requireRol } = require("../middleware/auth");
const { obtenerHorariosDisponibles, aMinutos } = require("../utils/disponibilidad");
const { notificar } = require("../services/notificaciones.service");

const router = express.Router();

function citaConDetalle(citaId) {
  return db
    .prepare(
      `SELECT c.*,
              u_cliente.nombre AS cliente_nombre,
              u_barbero.nombre AS barbero_nombre,
              s.nombre AS servicio_nombre, s.precio AS servicio_precio
       FROM citas c
       JOIN usuarios u_cliente ON u_cliente.id = c.cliente_id
       JOIN usuarios u_barbero ON u_barbero.id = c.barbero_id
       JOIN servicios s ON s.id = c.servicio_id
       WHERE c.id = ?`
    )
    .get(citaId);
}

// Perú (America/Lima) no tiene horario de verano, así que el offset es fijo: UTC-5.
// El servidor (Railway) corre en UTC, así que no podemos usar new Date() / horas
// locales del servidor para comparar contra "ahora" en hora de Lima: hay que
// desplazar la hora UTC real y comparar fecha/hora como texto, sin pasar por el
// parseo ambiguo de Date con strings sin 'Z'.
const OFFSET_LIMA_MIN = -5 * 60;

function fechaHoraLimaActual() {
  const ahoraUTC = new Date();
  const limaMs = ahoraUTC.getTime() + OFFSET_LIMA_MIN * 60 * 1000;
  const limaISO = new Date(limaMs).toISOString();
  return { fecha: limaISO.slice(0, 10), hora: limaISO.slice(11, 16) };
}

function esFechaPasada(fecha, hora) {
  const { fecha: fechaActual, hora: horaActual } = fechaHoraLimaActual();
  if (fecha !== fechaActual) return fecha < fechaActual;
  return hora < horaActual;
}

// RF02: disponibilidad en tiempo real según barbero + servicio + fecha elegidos.
router.get("/disponibilidad", requireAuth, (req, res) => {
  const { barbero_id, servicio_id, fecha } = req.query;
  if (!barbero_id || !servicio_id || !fecha) {
    return res.status(400).json({ error: "barbero_id, servicio_id y fecha son obligatorios." });
  }
  const servicio = db.prepare("SELECT * FROM servicios WHERE id = ?").get(servicio_id);
  if (!servicio) return res.status(404).json({ error: "Servicio no encontrado." });

  const horarios = obtenerHorariosDisponibles(db, Number(barbero_id), fecha, servicio.duracion_min);
  res.json({ fecha, duracion_min: servicio.duracion_min, horarios });
});

// RF02: crear una reserva (cliente).
router.post("/", requireAuth, requireRol("cliente"), (req, res) => {
  const { barbero_id, servicio_id, fecha, hora_inicio } = req.body;
  if (!barbero_id || !servicio_id || !fecha || !hora_inicio) {
    return res.status(400).json({ error: "barbero_id, servicio_id, fecha y hora_inicio son obligatorios." });
  }
  if (esFechaPasada(fecha, hora_inicio)) {
    return res.status(400).json({ error: "No se puede reservar en una fecha/hora ya pasada." });
  }

  const servicio = db.prepare("SELECT * FROM servicios WHERE id = ?").get(servicio_id);
  if (!servicio) return res.status(404).json({ error: "Servicio no encontrado." });
  const barbero = db.prepare("SELECT * FROM usuarios WHERE id = ? AND rol = 'barbero'").get(barbero_id);
  if (!barbero) return res.status(404).json({ error: "Barbero no encontrado." });

  // Se revalida la disponibilidad en el servidor (no solo en el navegador) para
  // evitar que dos clientes reserven el mismo horario al mismo tiempo.
  const disponibles = obtenerHorariosDisponibles(db, Number(barbero_id), fecha, servicio.duracion_min);
  const slot = disponibles.find((h) => h.hora_inicio === hora_inicio);
  if (!slot) {
    return res.status(409).json({ error: "Ese horario ya no está disponible. Elige otro." });
  }

  const info = db
    .prepare(
      `INSERT INTO citas (cliente_id, barbero_id, servicio_id, fecha, hora_inicio, hora_fin, estado)
       VALUES (?,?,?,?,?,?, 'confirmada')`
    )
    .run(req.usuario.id, barbero_id, servicio_id, fecha, slot.hora_inicio, slot.hora_fin);

  const cita = citaConDetalle(info.lastInsertRowid);
  const mensaje = notificar("confirmacion", cita);

  res.status(201).json({ cita, notificacion: mensaje });
});

// Historial del cliente autenticado.
router.get("/mias", requireAuth, requireRol("cliente"), (req, res) => {
  const citas = db
    .prepare(
      `SELECT c.*, u_barbero.nombre AS barbero_nombre, s.nombre AS servicio_nombre, s.precio AS servicio_precio
       FROM citas c
       JOIN usuarios u_barbero ON u_barbero.id = c.barbero_id
       JOIN servicios s ON s.id = c.servicio_id
       WHERE c.cliente_id = ?
       ORDER BY c.fecha DESC, c.hora_inicio DESC`
    )
    .all(req.usuario.id);
  res.json(citas);
});

// RF03: agenda del barbero autenticado para una fecha dada.
router.get("/agenda", requireAuth, requireRol("barbero", "administrador"), (req, res) => {
  const { fecha, barbero_id } = req.query;
  if (!fecha) return res.status(400).json({ error: "fecha es obligatoria (YYYY-MM-DD)." });

  // El barbero solo ve su propia agenda; el administrador puede consultar la de cualquiera.
  const idBarbero = req.usuario.rol === "barbero" ? req.usuario.id : barbero_id;
  if (!idBarbero) return res.status(400).json({ error: "barbero_id es obligatorio para el administrador." });

  const citas = db
    .prepare(
      `SELECT c.*, u_cliente.nombre AS cliente_nombre, s.nombre AS servicio_nombre
       FROM citas c
       JOIN usuarios u_cliente ON u_cliente.id = c.cliente_id
       JOIN servicios s ON s.id = c.servicio_id
       WHERE c.barbero_id = ? AND c.fecha = ? AND c.estado != 'cancelada'
       ORDER BY c.hora_inicio`
    )
    .all(idBarbero, fecha);
  res.json(citas);
});

// RF03: el barbero actualiza el estado de una cita de su agenda (ej. marcarla como atendida).
router.patch("/:id/estado", requireAuth, requireRol("barbero", "administrador"), (req, res) => {
  const { estado } = req.body;
  if (!["confirmada", "atendida", "cancelada"].includes(estado)) {
    return res.status(400).json({ error: "estado debe ser confirmada, atendida o cancelada." });
  }
  const cita = citaConDetalle(req.params.id);
  if (!cita) return res.status(404).json({ error: "Cita no encontrada." });
  if (req.usuario.rol === "barbero" && cita.barbero_id !== req.usuario.id) {
    return res.status(403).json({ error: "Esta cita no pertenece a tu agenda." });
  }

  db.prepare("UPDATE citas SET estado = ?, actualizado_en = datetime('now') WHERE id = ?").run(
    estado,
    req.params.id
  );

  if (estado === "cancelada") {
    notificar("cancelacion", cita);
  }

  res.json(citaConDetalle(req.params.id));
});

// Reprogramar o cancelar una cita (cliente dueño de la cita, o barbero/admin).
router.patch("/:id/reprogramar", requireAuth, (req, res) => {
  const { fecha, hora_inicio } = req.body;
  const cita = citaConDetalle(req.params.id);
  if (!cita) return res.status(404).json({ error: "Cita no encontrada." });

  const esDueno = req.usuario.rol === "cliente" && cita.cliente_id === req.usuario.id;
  const esStaff = req.usuario.rol === "barbero" || req.usuario.rol === "administrador";
  if (!esDueno && !esStaff) {
    return res.status(403).json({ error: "No tienes permiso para modificar esta cita." });
  }
  if (cita.estado === "atendida") {
    return res.status(400).json({ error: "No se puede reprogramar una cita ya atendida." });
  }
  if (!fecha || !hora_inicio) {
    return res.status(400).json({ error: "fecha y hora_inicio son obligatorios." });
  }

  const servicio = db.prepare("SELECT * FROM servicios WHERE id = ?").get(cita.servicio_id);
  const disponibles = obtenerHorariosDisponibles(db, cita.barbero_id, fecha, servicio.duracion_min, cita.id);
  const slot = disponibles.find((h) => h.hora_inicio === hora_inicio);
  if (!slot) {
    return res.status(409).json({ error: "Ese horario no está disponible para reprogramar." });
  }

  db.prepare(
    "UPDATE citas SET fecha = ?, hora_inicio = ?, hora_fin = ?, actualizado_en = datetime('now') WHERE id = ?"
  ).run(fecha, slot.hora_inicio, slot.hora_fin, req.params.id);

  const actualizada = citaConDetalle(req.params.id);
  notificar("confirmacion", actualizada);
  res.json(actualizada);
});

// Cancelación directa (atajo sobre /estado).
router.patch("/:id/cancelar", requireAuth, (req, res) => {
  const cita = citaConDetalle(req.params.id);
  if (!cita) return res.status(404).json({ error: "Cita no encontrada." });
  const esDueno = req.usuario.rol === "cliente" && cita.cliente_id === req.usuario.id;
  const esStaff = req.usuario.rol === "barbero" || req.usuario.rol === "administrador";
  if (!esDueno && !esStaff) {
    return res.status(403).json({ error: "No tienes permiso para cancelar esta cita." });
  }

  db.prepare("UPDATE citas SET estado = 'cancelada', actualizado_en = datetime('now') WHERE id = ?").run(
    req.params.id
  );
  notificar("cancelacion", cita);
  res.json({ ok: true });
});

// RF04: disparo manual de recordatorio (en producción iría en un job programado
// que revise las citas del día siguiente; aquí se deja como acción manual del
// barbero/administrador para la demo).
router.post("/:id/recordatorio", requireAuth, requireRol("barbero", "administrador"), (req, res) => {
  const cita = citaConDetalle(req.params.id);
  if (!cita) return res.status(404).json({ error: "Cita no encontrada." });
  const mensaje = notificar("recordatorio", cita);
  res.json({ ok: true, mensaje });
});

module.exports = router;
