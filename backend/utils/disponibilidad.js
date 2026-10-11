// Lógica de disponibilidad de agenda.
// Regla de negocio acordada en el DV1/DV2: la duración ocupada en la agenda la define
// el SERVICIO elegido (no se calcula con IA ni es fija por barbero), más un margen
// (buffer) entre citas para absorber pequeños retrasos.
const HORA_APERTURA = "09:00";
const HORA_CIERRE = "19:00";
const PASO_MIN = 15; // cada cuánto se ofrece un horario candidato
const BUFFER_MIN = 10; // margen entre una cita y la siguiente

function aMinutos(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
function aHHMM(mins) {
  const h = Math.floor(mins / 60)
    .toString()
    .padStart(2, "0");
  const m = (mins % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function seSuperponen(iniA, finA, iniB, finB) {
  return iniA < finB && iniB < finA;
}

/**
 * Devuelve los bloques de horario disponibles para un barbero en una fecha,
 * dada la duración (en minutos) del servicio elegido.
 * @param {import('better-sqlite3').Database} db
 * @param {number} barberoId
 * @param {string} fecha YYYY-MM-DD
 * @param {number} duracionMin
 * @param {number|null} citaIdExcluir para reprogramaciones: no chocar contra la propia cita
 */
function obtenerHorariosDisponibles(db, barberoId, fecha, duracionMin, citaIdExcluir = null) {
  const citasDelDia = db
    .prepare(
      `SELECT id, hora_inicio, hora_fin FROM citas
       WHERE barbero_id = ? AND fecha = ? AND estado != 'cancelada'
       ${citaIdExcluir ? "AND id != ?" : ""}`
    )
    .all(...(citaIdExcluir ? [barberoId, fecha, citaIdExcluir] : [barberoId, fecha]));

  const ocupados = citasDelDia.map((c) => ({
    inicio: aMinutos(c.hora_inicio) - BUFFER_MIN,
    fin: aMinutos(c.hora_fin) + BUFFER_MIN,
  }));

  const apertura = aMinutos(HORA_APERTURA);
  const cierre = aMinutos(HORA_CIERRE);
  const disponibles = [];

  for (let inicio = apertura; inicio + duracionMin <= cierre; inicio += PASO_MIN) {
    const fin = inicio + duracionMin;
    const chocaConAlguna = ocupados.some((o) => seSuperponen(inicio, fin, o.inicio, o.fin));
    if (!chocaConAlguna) {
      disponibles.push({ hora_inicio: aHHMM(inicio), hora_fin: aHHMM(fin) });
    }
  }
  return disponibles;
}

module.exports = {
  obtenerHorariosDisponibles,
  HORA_APERTURA,
  HORA_CIERRE,
  BUFFER_MIN,
  aMinutos,
  aHHMM,
  seSuperponen,
};
