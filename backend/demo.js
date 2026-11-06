// Uso (en la consola/shell de Railway o en local)
const db = require("./db");
const { obtenerHorariosDisponibles } = require("./utils/disponibilidad");

const EMAIL_BARBERO = "jhon@barberking.pe";
const MIN_CITAS = 5;
const MAX_CITAS = 8;
const PROB_CANCELADA = 0.1;

function rng(semilla) {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const semillaDe = (fecha) => Number(fecha.replaceAll("-", ""));

function hoyLima() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
}
function sumarDias(fecha, dias) {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
function diaSemana(fecha) {
  return new Date(`${fecha}T12:00:00Z`).getUTCDay(); // 0 = domingo, 1 = lunes
}
function sieteDias(fecha, desde) {
  return [0, 1, 2, 3, 4, 5, 6].map((i) => sumarDias(fecha, desde + i)).filter((f) => diaSemana(f) !== 0);
}

const referencia = process.argv[2] || hoyLima();
if (!/^\d{4}-\d{2}-\d{2}$/.test(referencia)) {
  throw new Error(`Fecha de referencia inválida: "${referencia}". Usa el formato AAAA-MM-DD.`);
}
const semanaPasada = sieteDias(referencia, -7);
const semanaProxima = sieteDias(referencia, 1);

const barbero = db
  .prepare("SELECT id, nombre FROM usuarios WHERE email = ? AND rol = 'barbero'")
  .get(EMAIL_BARBERO);
if (!barbero) throw new Error(`No existe el barbero ${EMAIL_BARBERO}.`);

const servicios = db
  .prepare("SELECT id, nombre, duracion_min FROM servicios WHERE activo = 1 ORDER BY id")
  .all();
if (servicios.length === 0) throw new Error('No hay servicios activos. Corre "npm run seed" primero.');

const clientes = db.prepare("SELECT id FROM usuarios WHERE rol = 'cliente' ORDER BY id").all();
if (clientes.length === 0) {
  throw new Error("No hay clientes registrados. Crea al menos uno o corre el seed de demo primero.");
}

const corteClasico = servicios.find((s) => s.nombre === "Corte clásico");
const bolsaServicios = corteClasico ? [...servicios, corteClasico, corteClasico] : servicios;

const insertarCita = db.prepare(
  `INSERT INTO citas (cliente_id, barbero_id, servicio_id, fecha, hora_inicio, hora_fin, estado)
   VALUES (?,?,?,?,?,?,?)`
);
const insertarNotificacion = db.prepare(
  "INSERT INTO notificaciones (cita_id, tipo, canal, mensaje) VALUES (?,?,?,?)"
);
const contarCitasDelDia = db.prepare(
  "SELECT COUNT(*) AS n FROM citas WHERE barbero_id = ? AND fecha = ? AND estado != 'cancelada'"
);

const aMin = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

function llenarDia(fecha, esPasado) {
  if (contarCitasDelDia.get(barbero.id, fecha).n >= MIN_CITAS) {
    return { fecha, creadas: 0, saltado: true };
  }
  const azar = rng(semillaDe(fecha));
  const cantidad = MIN_CITAS + Math.floor(azar() * (MAX_CITAS - MIN_CITAS + 1));
  const inicioDia = 9 * 60;
  const finDia = 19 * 60;
  const tramo = (finDia - inicioDia) / cantidad;

  let creadas = 0;
  for (let i = 0; i < cantidad; i++) {
    const servicio = bolsaServicios[Math.floor(azar() * bolsaServicios.length)];
    const cliente = clientes[Math.floor(azar() * clientes.length)];
    const objetivo = inicioDia + i * tramo + azar() * (tramo / 2);

    const libres = obtenerHorariosDisponibles(db, barbero.id, fecha, servicio.duracion_min);
    const slot = libres.find((h) => aMin(h.hora_inicio) >= objetivo) || libres.at(-1);
    if (!slot) break;

    const estado = esPasado ? (azar() < PROB_CANCELADA ? "cancelada" : "atendida") : "confirmada";
    const info = insertarCita.run(cliente.id, barbero.id, servicio.id, fecha, slot.hora_inicio, slot.hora_fin, estado);
    const base = `Cita con ${barbero.nombre} (${servicio.nombre}) el ${fecha} a las ${slot.hora_inicio}.`;
    insertarNotificacion.run(info.lastInsertRowid, "confirmacion", "correo", `Tu cita fue confirmada. ${base}`);
    if (estado === "cancelada") {
      insertarNotificacion.run(info.lastInsertRowid, "cancelacion", "correo", `Tu cita fue cancelada. ${base}`);
    }
    creadas++;
  }
  return { fecha, creadas, saltado: false };
}

const resultados = db.transaction(() => [
  ...semanaPasada.map((f) => llenarDia(f, true)),
  ...semanaProxima.map((f) => llenarDia(f, false)),
])();

console.log(`Barbero: ${barbero.nombre} · referencia: ${referencia}`);
for (const r of resultados) {
  console.log(`  ${r.fecha}: ${r.saltado ? "ya tenía citas, se saltó" : `${r.creadas} citas creadas`}`);
}
const total = resultados.reduce((s, r) => s + r.creadas, 0);
console.log(`Total: ${total} citas nuevas.`);