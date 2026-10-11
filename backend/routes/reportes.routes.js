// Módulo de Reportes (RF05): ingresos, ocupación y clientes frecuentes para el
// panel del administrador.
const express = require("express");
const db = require("../db");
const { requireAuth, requireRol } = require("../middleware/auth");
const { HORA_APERTURA, HORA_CIERRE, aMinutos } = require("../utils/disponibilidad");

const router = express.Router();
router.use(requireAuth, requireRol("administrador"));

// Ingresos: suma de servicios de citas ATENDIDAS (el cobro se sigue registrando
// manualmente, tal como se definió en el alcance del ACS1/DV2; el sistema solo
// refleja lo efectivamente atendido).
router.get("/ingresos", (req, res) => {
  const { desde, hasta } = req.query;
  const filtroFechas =
    desde && hasta ? "AND c.fecha BETWEEN ? AND ?" : "";
  const params = desde && hasta ? [desde, hasta] : [];

  const total = db
    .prepare(
      `SELECT COALESCE(SUM(s.precio), 0) AS ingresos_totales, COUNT(*) AS citas_atendidas
       FROM citas c JOIN servicios s ON s.id = c.servicio_id
       WHERE c.estado = 'atendida' ${filtroFechas}`
    )
    .get(...params);

  const porDia = db
    .prepare(
      `SELECT c.fecha, COALESCE(SUM(s.precio), 0) AS ingresos, COUNT(*) AS citas
       FROM citas c JOIN servicios s ON s.id = c.servicio_id
       WHERE c.estado = 'atendida' ${filtroFechas}
       GROUP BY c.fecha ORDER BY c.fecha`
    )
    .all(...params);

  const porServicio = db
    .prepare(
      `SELECT s.nombre AS servicio, COALESCE(SUM(s.precio), 0) AS ingresos, COUNT(*) AS citas
       FROM citas c JOIN servicios s ON s.id = c.servicio_id
       WHERE c.estado = 'atendida' ${filtroFechas}
       GROUP BY s.id ORDER BY ingresos DESC`
    )
    .all(...params);

  res.json({ ...total, porDia, porServicio });
});

// Ocupación por barbero en una fecha concreta: minutos reservados / minutos de jornada.
router.get("/ocupacion", (req, res) => {
  const { fecha } = req.query;
  if (!fecha) return res.status(400).json({ error: "fecha es obligatoria (YYYY-MM-DD)." });

  const minutosJornada = aMinutos(HORA_CIERRE) - aMinutos(HORA_APERTURA);
  const barberos = db.prepare("SELECT id, nombre FROM usuarios WHERE rol = 'barbero'").all();

  const resultado = barberos.map((b) => {
    const citas = db
      .prepare(
        `SELECT hora_inicio, hora_fin FROM citas
         WHERE barbero_id = ? AND fecha = ? AND estado != 'cancelada'`
      )
      .all(b.id, fecha);
    const minutosOcupados = citas.reduce(
      (acc, c) => acc + (aMinutos(c.hora_fin) - aMinutos(c.hora_inicio)),
      0
    );
    const ocupacionPct = Math.round((minutosOcupados / minutosJornada) * 1000) / 10;
    return {
      barbero_id: b.id,
      barbero: b.nombre,
      citas: citas.length,
      minutos_ocupados: minutosOcupados,
      minutos_jornada: minutosJornada,
      ocupacion_pct: ocupacionPct,
    };
  });

  res.json({ fecha, barberos: resultado });
});

// Clientes frecuentes: ranking por número de citas atendidas.
router.get("/clientes-frecuentes", (req, res) => {
  const limite = Number(req.query.limite) || 10;
  const clientes = db
    .prepare(
      `SELECT u.id, u.nombre, u.email, COUNT(*) AS citas_atendidas,
              COALESCE(SUM(s.precio), 0) AS gasto_total
       FROM citas c
       JOIN usuarios u ON u.id = c.cliente_id
       JOIN servicios s ON s.id = c.servicio_id
       WHERE c.estado = 'atendida'
       GROUP BY u.id
       ORDER BY citas_atendidas DESC, gasto_total DESC
       LIMIT ?`
    )
    .all(limite);
  res.json(clientes);
});

module.exports = router;
