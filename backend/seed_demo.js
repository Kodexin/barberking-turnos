// Datos de demostración para la sustentación: clientes, citas y notificaciones
// realistas para el 12 de octubre de 2026, repartidas entre los dos barberos.
//
// Se insertan directamente en la base de datos (no a través de la API de reservas),
// así que este script en sí NO dispara ningún envío de correo. Los clientes de
// demo sí quedan con direcciones @gmail.com con apariencia real para que la
// presentación se vea natural; OJO: con Brevo ya configurado, el sistema SÍ
// puede entregar a cualquier destinatario, así que presionar "Enviar
// recordatorio" sobre estas citas desde el panel del barbero intentará
// mandar un correo real a esas direcciones de demo (que probablemente no
// existen o no son tuyas). Evita hacerlo salvo que quieras probar con un
// correo que de verdad controles.
//
// Uso: node backend/seed_demo.js   (ejecutar en la consola/shell de Railway,
// después de haber corrido "npm run seed" al menos una vez).
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
  const row = db.prepare("SELECT id, duracion_min, precio FROM servicios WHERE nombre = ?").get(nombre);
  if (!row) throw new Error(`Servicio "${nombre}" no existe. Corre "npm run seed" primero.`);
  return row;
}

function idBarbero(email) {
  const row = db.prepare("SELECT id FROM usuarios WHERE email = ? AND rol = 'barbero'").get(email);
  if (!row) throw new Error(`Barbero "${email}" no existe. Corre "npm run seed" primero.`);
  return row.id;
}

function sumarMin(hhmm, min) {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + min;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function insertarCita({ clienteId, barberoId, servicio, fecha, hora_inicio, estado }) {
  const hora_fin = sumarMin(hora_inicio, servicio.duracion_min);
  const existente = db
    .prepare("SELECT id FROM citas WHERE cliente_id=? AND barbero_id=? AND fecha=? AND hora_inicio=?")
    .get(clienteId, barberoId, fecha, hora_inicio);
  if (existente) return existente.id;
  const info = db
    .prepare(
      `INSERT INTO citas (cliente_id, barbero_id, servicio_id, fecha, hora_inicio, hora_fin, estado)
       VALUES (?,?,?,?,?,?,?)`
    )
    .run(clienteId, barberoId, servicio.id, fecha, hora_inicio, hora_fin, estado);
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

function mensajeConfirmacion(cliente, barbero, servicio, fecha, hora) {
  return `Tu cita fue confirmada. Cita con ${barbero} (${servicio}) el ${fecha} a las ${hora}.`;
}

// --- Datos base ---
const FECHA = "2026-10-12";
const jhonId = idBarbero("jhon@barberking.pe");
const luisId = idBarbero("luis@barberking.pe");
const jhonNombre = "Jhon Quispe";
const luisNombre = "Luis Mamani";

const corteClasico = idServicio("Corte clásico");
const corteBarba = idServicio("Corte + barba");
const corteBarbaCejas = idServicio("Corte + barba + cejas");
const afeitado = idServicio("Afeitado tradicional");

// --- Clientes de demo (apariencia real: nombre + @gmail.com) ---
const clientes = {
  maria: upsertUsuario("María Fernanda Apaza", "mfapaza27@gmail.com", "cliente123", "cliente"),
  jorge: upsertUsuario("Jorge Luis Ticona", "jorgeticona.lt@gmail.com", "cliente123", "cliente"),
  rosa: upsertUsuario("Rosa Elena Chambi", "rosae.chambi@gmail.com", "cliente123", "cliente"),
  carlos: upsertUsuario("Carlos Alberto Flores", "carlosflores.alb@gmail.com", "cliente123", "cliente"),
  diana: upsertUsuario("Diana Patricia Mamani", "dianapmamani@gmail.com", "cliente123", "cliente"),
  andres: upsertUsuario("Andrés Felipe Quispe", "andresf.quispe92@gmail.com", "cliente123", "cliente"),
  lucia: upsertUsuario("Lucía Beatriz Cutipa", "luciab.cutipa@gmail.com", "cliente123", "cliente"),
  miguel: upsertUsuario("Miguel Ángel Vilca", "miguelangel.vilca05@gmail.com", "cliente123", "cliente"),
  valeria: upsertUsuario("Valeria Nicole Pari", "valen.pari@gmail.com", "cliente123", "cliente"),
};

const nombreCliente = {};
for (const key in clientes) {
  nombreCliente[clientes[key]] = db.prepare("SELECT nombre FROM usuarios WHERE id = ?").get(clientes[key]).nombre;
}

// --- Agenda del 12 de octubre (buffer de 10 min respetado entre citas) ---
const agenda = [
  // Jhon
  { cliente: clientes.maria, barberoId: jhonId, barberoNombre: jhonNombre, servicio: corteClasico, hora: "09:00", estado: "atendida" },
  { cliente: clientes.jorge, barberoId: jhonId, barberoNombre: jhonNombre, servicio: corteBarba, hora: "09:45", estado: "atendida" },
  { cliente: clientes.rosa, barberoId: jhonId, barberoNombre: jhonNombre, servicio: afeitado, hora: "10:45", estado: "atendida" },
  { cliente: clientes.carlos, barberoId: jhonId, barberoNombre: jhonNombre, servicio: corteClasico, hora: "11:30", estado: "cancelada" },
  { cliente: clientes.diana, barberoId: jhonId, barberoNombre: jhonNombre, servicio: corteBarbaCejas, hora: "15:00", estado: "confirmada" },
  { cliente: clientes.andres, barberoId: jhonId, barberoNombre: jhonNombre, servicio: corteClasico, hora: "16:15", estado: "confirmada" },
  // Luis
  { cliente: clientes.lucia, barberoId: luisId, barberoNombre: luisNombre, servicio: corteBarba, hora: "09:00", estado: "atendida" },
  { cliente: clientes.miguel, barberoId: luisId, barberoNombre: luisNombre, servicio: corteClasico, hora: "10:00", estado: "atendida" },
  { cliente: clientes.maria, barberoId: luisId, barberoNombre: luisNombre, servicio: afeitado, hora: "10:45", estado: "atendida" },
  { cliente: clientes.jorge, barberoId: luisId, barberoNombre: luisNombre, servicio: corteClasico, hora: "13:00", estado: "atendida" },
  { cliente: clientes.valeria, barberoId: luisId, barberoNombre: luisNombre, servicio: corteBarbaCejas, hora: "14:00", estado: "confirmada" },
  { cliente: clientes.carlos, barberoId: luisId, barberoNombre: luisNombre, servicio: corteClasico, hora: "17:00", estado: "confirmada" },
];

const serviciosPorId = { [corteClasico.id]: corteClasico, [corteBarba.id]: corteBarba, [corteBarbaCejas.id]: corteBarbaCejas, [afeitado.id]: afeitado };
const nombreServicio = db.prepare("SELECT id, nombre FROM servicios").all().reduce((acc, s) => ((acc[s.id] = s.nombre), acc), {});

let creadas = 0;
for (const item of agenda) {
  const servicio = serviciosPorId[item.servicio.id];
  const citaId = insertarCita({
    clienteId: item.cliente,
    barberoId: item.barberoId,
    servicio,
    fecha: FECHA,
    hora_inicio: item.hora,
    estado: item.estado,
  });
  creadas++;

  if (item.estado !== "cancelada") {
    const mensaje = mensajeConfirmacion(
      nombreCliente[item.cliente],
      item.barberoNombre,
      nombreServicio[servicio.id],
      FECHA,
      item.hora
    );
    insertarNotificacion(citaId, "confirmacion", mensaje);
  }
  if (item.estado === "confirmada") {
    const mensaje = `Recordatorio: tienes una cita pronto. Cita con ${item.barberoNombre} (${nombreServicio[servicio.id]}) el ${FECHA} a las ${item.hora}.`;
    insertarNotificacion(citaId, "recordatorio", mensaje);
  }
  if (item.estado === "cancelada") {
    const mensaje = `Tu cita fue cancelada. Cita con ${item.barberoNombre} (${nombreServicio[servicio.id]}) el ${FECHA} a las ${item.hora}.`;
    insertarNotificacion(citaId, "cancelacion", mensaje);
  }
}

console.log(`Datos de demo listos para ${FECHA}: ${creadas} citas (y sus notificaciones) insertadas/verificadas.`);
console.log("Clientes de demo (contraseña cliente123 para todos, correos ficticios):");
Object.values(clientes).forEach((id) => console.log("  -", nombreCliente[id]));
