// Reemplaza TODAS las citas (atendidas y pendientes) y sus notificaciones por
// un nuevo set de 7 citas de demo, todas con clientes hombres, para el 12 de
// octubre de 2026, con Jhon Segales como único barbero.
//
// Es destructivo a propósito: borra la tabla de citas y notificaciones por
// completo antes de insertar el nuevo set. Las cuentas de clientes de la demo
// anterior (si no tienen más citas) se quedan en la base sin usarse, pero no
// aparecen en ningún reporte.
//
// Uso: node backend/reset_citas_demo.js   (en la consola/shell de Railway)
const bcrypt = require("bcryptjs");
const db = require("./db");

function upsertUsuario(nombre, email, password, rol) {
  const existente = db.prepare("SELECT id FROM usuarios WHERE email = ?").get(email);
  if (existente) return existente.id;
  const hash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare("INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES (?,?,?,?)")
    .run(nombre, email, hash, rol);
  return info.lastInsertRowid;
}

function idServicio(nombre) {
  const row = db.prepare("SELECT id, duracion_min FROM servicios WHERE nombre = ?").get(nombre);
  if (!row) throw new Error(`Servicio "${nombre}" no existe. Corre "npm run seed" primero.`);
  return row;
}

function idBarbero(email) {
  const row = db.prepare("SELECT id, nombre FROM usuarios WHERE email = ? AND rol = 'barbero'").get(email);
  if (!row) throw new Error(`Barbero "${email}" no existe.`);
  return row;
}

function sumarMin(hhmm, min) {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + min;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

// --- 1. Borrar TODAS las citas y notificaciones existentes ---
const borradas = db.prepare("DELETE FROM notificaciones").run().changes;
const citasBorradas = db.prepare("DELETE FROM citas").run().changes;
console.log(`Borradas ${citasBorradas} cita(s) y ${borradas} notificación(es) existentes.`);

// --- 2. Datos base ---
const FECHA = "2026-10-12";
const jhon = idBarbero("jhon@barberking.pe");

const corteClasico = idServicio("Corte clásico");
const corteBarba = idServicio("Corte + barba");
const corteBarbaCejas = idServicio("Corte + barba + cejas");
const afeitado = idServicio("Afeitado tradicional");

// --- 3. Clientes hombres (apariencia real: nombre + @gmail.com) ---
const clientes = {
  carlos: upsertUsuario("Carlos Alberto Flores", "carlosflores.alb@gmail.com", "cliente123", "cliente"),
  jorge: upsertUsuario("Jorge Luis Ticona", "jorgeticona.lt@gmail.com", "cliente123", "cliente"),
  miguel: upsertUsuario("Miguel Ángel Vilca", "miguelangel.vilca05@gmail.com", "cliente123", "cliente"),
  andres: upsertUsuario("Andrés Felipe Quispe", "andresf.quispe92@gmail.com", "cliente123", "cliente"),
  diego: upsertUsuario("Diego Fernando Choque", "diegof.choque@gmail.com", "cliente123", "cliente"),
  renzo: upsertUsuario("Renzo Gabriel Pari", "renzogpari@gmail.com", "cliente123", "cliente"),
};

const nombreCliente = {};
for (const key in clientes) {
  nombreCliente[clientes[key]] = db.prepare("SELECT nombre FROM usuarios WHERE id = ?").get(clientes[key]).nombre;
}

// --- 4. Agenda del 12 de octubre: 7 citas, todas con Jhon Segales ---
const agenda = [
  { cliente: clientes.carlos, servicio: corteClasico,    hora: "09:00", estado: "atendida" },
  { cliente: clientes.jorge,  servicio: corteBarba,      hora: "09:45", estado: "atendida" },
  { cliente: clientes.miguel, servicio: afeitado,        hora: "10:45", estado: "atendida" },
  { cliente: clientes.andres, servicio: corteClasico,    hora: "11:30", estado: "atendida" },
  { cliente: clientes.diego,  servicio: corteBarbaCejas, hora: "13:00", estado: "atendida" },
  { cliente: clientes.jorge,  servicio: corteClasico,    hora: "15:00", estado: "confirmada" }, // 2da visita de Jorge
  { cliente: clientes.renzo,  servicio: corteBarba,      hora: "16:00", estado: "confirmada" },
];

function insertarCita({ clienteId, servicio, hora, estado }) {
  const hora_fin = sumarMin(hora, servicio.duracion_min);
  const info = db
    .prepare(
      `INSERT INTO citas (cliente_id, barbero_id, servicio_id, fecha, hora_inicio, hora_fin, estado)
       VALUES (?,?,?,?,?,?,?)`
    )
    .run(clienteId, jhon.id, servicio.id, FECHA, hora, hora_fin, estado);
  return info.lastInsertRowid;
}

function insertarNotificacion(citaId, tipo, mensaje) {
  db.prepare("INSERT INTO notificaciones (cita_id, tipo, canal, mensaje) VALUES (?,?,?,?)").run(
    citaId,
    tipo,
    "correo",
    mensaje
  );
}

const nombreServicio = db.prepare("SELECT id, nombre FROM servicios").all().reduce((acc, s) => ((acc[s.id] = s.nombre), acc), {});

let creadas = 0;
for (const item of agenda) {
  const citaId = insertarCita(item);
  creadas++;
  const servicioNombre = nombreServicio[item.servicio.id];

  const mensajeConf = `Tu cita fue confirmada. Cita con ${jhon.nombre} (${servicioNombre}) el ${FECHA} a las ${item.hora}.`;
  insertarNotificacion(citaId, "confirmacion", mensajeConf);

  if (item.estado === "confirmada") {
    const mensajeRec = `Recordatorio: tienes una cita pronto. Cita con ${jhon.nombre} (${servicioNombre}) el ${FECHA} a las ${item.hora}.`;
    insertarNotificacion(citaId, "recordatorio", mensajeRec);
  }
}

console.log(`Creadas ${creadas} citas nuevas para ${FECHA} con ${jhon.nombre} como barbero.`);
console.log("Clientes (contraseña cliente123, correos tipo Gmail):");
Object.values(clientes).forEach((id) => console.log("  -", nombreCliente[id]));
