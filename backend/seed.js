// Carga datos iniciales: administrador, barberos de ejemplo y el catálogo de servicios
// (cada servicio con su duración, que es lo que define el bloque de agenda ocupado,
// tal como se acordó en el DV1/DV2).
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

function upsertServicio(nombre, duracion_min, precio) {
  const existente = db.prepare("SELECT id FROM servicios WHERE nombre = ?").get(nombre);
  if (existente) return existente.id;
  const info = db
    .prepare("INSERT INTO servicios (nombre, duracion_min, precio) VALUES (?,?,?)")
    .run(nombre, duracion_min, precio);
  return info.lastInsertRowid;
}

const adminId = upsertUsuario("Administrador BarberKing", "admin@barberking.pe", "admin123", "administrador");
const barbero1 = upsertUsuario("Jhon Quispe", "jhon@barberking.pe", "barbero123", "barbero");
const barbero2 = upsertUsuario("Luis Mamani", "luis@barberking.pe", "barbero123", "barbero");
const clienteDemo = upsertUsuario("Cliente Demo", "cliente@demo.pe", "cliente123", "cliente");

upsertServicio("Corte clásico", 30, 20);
upsertServicio("Corte + barba", 45, 30);
upsertServicio("Corte + barba + cejas", 60, 40);
upsertServicio("Afeitado tradicional", 30, 18);

console.log("Datos de ejemplo listos:");
console.log({ adminId, barbero1, barbero2, clienteDemo });
console.log("\nCredenciales de prueba:");
console.log("  Admin:    admin@barberking.pe / admin123");
console.log("  Barbero:  jhon@barberking.pe / barbero123");
console.log("  Barbero:  luis@barberking.pe / barbero123");
console.log("  Cliente:  cliente@demo.pe / cliente123");
