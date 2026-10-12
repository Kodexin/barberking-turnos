// Agrega 6 citas nuevas de demo para el 13 de octubre de 2026, todas con
// Jhon Segales como barbero, con horarios más separados entre sí que el
// set del 12 de octubre. 3 de las 6 son "Corte clásico".
//
// NO borra nada existente: solo agrega estas 6 citas nuevas (si ya existe
// una cita en la misma fecha/hora con el mismo cliente, se salta en vez de
// duplicarla). Como el día aún no llega, todas quedan en estado "confirmada".
//
// Uso: node backend/add_citas_13oct.js   (en la consola/shell de Railway)
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

// --- Datos base ---
const FECHA = "2026-10-13";
const jhon = idBarbero("jhon@barberking.pe");

const corteClasico = idServicio("Corte clásico");
const corteBarba = idServicio("Corte + barba");
const corteBarbaCejas = idServicio("Corte + barba + cejas");
const afeitado = idServicio("Afeitado tradicional");

// --- Clientes nuevos (hombres, apariencia real) ---
const clientes = {
  fernando: upsertUsuario("Fernando José Huanca", "fernandoh.jose@gmail.com", "cliente123", "cliente"),
  ricardo: upsertUsuario("Ricardo Daniel Condori", "ricardo.condori88@gmail.com", "cliente123", "cliente"),
  alexis: upsertUsuario("Alexis Martín Zapata", "alexism.zapata@gmail.com", "cliente123", "cliente"),
  bruno: upsertUsuario("Bruno Rodrigo Apaza", "brunorodrigo.apaza@gmail.com", "cliente123", "cliente"),
  gonzalo: upsertUsuario("Gonzalo Iván Mamani", "gonzaloivan.mamani@gmail.com", "cliente123", "cliente"),
  samuel: upsertUsuario("Samuel Eduardo Yupanqui", "samueled.yupanqui@gmail.com", "cliente123", "cliente"),
};

const nombreCliente = {};
for (const key in clientes) {
  nombreCliente[clientes[key]] = db.prepare("SELECT nombre FROM usuarios WHERE id = ?").get(clientes[key]).nombre;
}

// --- Agenda del 13 de octubre: 6 citas, horarios con bastante separación ---
const agenda = [
  { cliente: clientes.fernando, servicio: corteClasico,    hora: "09:00" },
  { cliente: clientes.ricardo,  servicio: corteBarba,      hora: "11:00" },
  { cliente: clientes.alexis,   servicio: corteClasico,    hora: "13:00" },
  { cliente: clientes.bruno,    servicio: corteBarbaCejas, hora: "15:00" },
  { cliente: clientes.gonzalo,  servicio: corteClasico,    hora: "17:00" },
  { cliente: clientes.samuel,   servicio: afeitado,        hora: "18:30" },
];

function insertarCita({ cliente, servicio, hora }) {
  const existente = db
    .prepare("SELECT id FROM citas WHERE cliente_id=? AND barbero_id=? AND fecha=? AND hora_inicio=?")
    .get(cliente, jhon.id, FECHA, hora);
  if (existente) return { id: existente.id, creada: false };

  const hora_fin = sumarMin(hora, servicio.duracion_min);
  const info = db
    .prepare(
      `INSERT INTO citas (cliente_id, barbero_id, servicio_id, fecha, hora_inicio, hora_fin, estado)
       VALUES (?,?,?,?,?,?,?)`
    )
    .run(cliente, jhon.id, servicio.id, FECHA, hora, hora_fin, "confirmada");
  return { id: info.lastInsertRowid, creada: true };
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
let saltadas = 0;
for (const item of agenda) {
  const { id: citaId, creada } = insertarCita(item);
  if (!creada) {
    saltadas++;
    continue;
  }
  creadas++;
  const servicioNombre = nombreServicio[item.servicio.id];

  const mensajeConf = `Tu cita fue confirmada. Cita con ${jhon.nombre} (${servicioNombre}) el ${FECHA} a las ${item.hora}.`;
  insertarNotificacion(citaId, "confirmacion", mensajeConf);

  const mensajeRec = `Recordatorio: tienes una cita pronto. Cita con ${jhon.nombre} (${servicioNombre}) el ${FECHA} a las ${item.hora}.`;
  insertarNotificacion(citaId, "recordatorio", mensajeRec);
}

console.log(`Creadas ${creadas} citas nuevas para ${FECHA} con ${jhon.nombre} como barbero (${saltadas} ya existían y se saltaron).`);
console.log("Clientes nuevos (contraseña cliente123, correos tipo Gmail):");
Object.values(clientes).forEach((id) => console.log("  -", nombreCliente[id]));
