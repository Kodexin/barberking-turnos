// Limpieza puntual antes de la sustentación:
//   1. Elimina por completo a Luis Mamani (barbero): sus citas, sus
//      notificaciones y su cuenta de usuario.
//   2. Elimina por completo a "Cliente Demo" (cliente@demo.pe): sus citas,
//      sus notificaciones y su cuenta de usuario.
//   3. Renombra a Jhon Quispe -> "Jhon Segales" (el correo de inicio de
//      sesión jhon@barberking.pe no cambia).
//
// Es seguro volver a correrlo: si una cuenta ya no existe, simplemente la
// salta en vez de fallar.
//
// Uso: node backend/cleanup_pre_sustentacion.js   (en la consola/shell de Railway)
const db = require("./db");

function eliminarUsuarioYSusCitas(email, rolEsperado) {
  const usuario = db.prepare("SELECT id, nombre FROM usuarios WHERE email = ?").get(email);
  if (!usuario) {
    console.log(`(sin cambios) no existe un usuario con correo ${email}.`);
    return;
  }
  if (rolEsperado) {
    const fila = db.prepare("SELECT rol FROM usuarios WHERE id = ?").get(usuario.id);
    if (fila.rol !== rolEsperado) {
      console.log(`(omitido) ${email} no tiene el rol esperado (${rolEsperado}); no se tocó nada.`);
      return;
    }
  }

  const columnaCitas = rolEsperado === "barbero" ? "barbero_id" : "cliente_id";
  const citas = db.prepare(`SELECT id FROM citas WHERE ${columnaCitas} = ?`).all(usuario.id);
  const idsCitas = citas.map((c) => c.id);

  let notifBorradas = 0;
  if (idsCitas.length) {
    const placeholders = idsCitas.map(() => "?").join(",");
    const info = db.prepare(`DELETE FROM notificaciones WHERE cita_id IN (${placeholders})`).run(...idsCitas);
    notifBorradas = info.changes;
    db.prepare(`DELETE FROM citas WHERE ${columnaCitas} = ?`).run(usuario.id);
  }

  db.prepare("DELETE FROM usuarios WHERE id = ?").run(usuario.id);
  console.log(
    `Eliminado: ${usuario.nombre} (${email}) junto con ${idsCitas.length} cita(s) y ${notifBorradas} notificación(es).`
  );
}

function renombrarUsuario(email, nombreNuevo) {
  const usuario = db.prepare("SELECT id, nombre FROM usuarios WHERE email = ?").get(email);
  if (!usuario) {
    console.log(`(sin cambios) no existe un usuario con correo ${email}.`);
    return;
  }
  db.prepare("UPDATE usuarios SET nombre = ? WHERE id = ?").run(nombreNuevo, usuario.id);
  console.log(`Renombrado: "${usuario.nombre}" -> "${nombreNuevo}" (${email}).`);
}

eliminarUsuarioYSusCitas("luis@barberking.pe", "barbero");
eliminarUsuarioYSusCitas("cliente@demo.pe", "cliente");
renombrarUsuario("jhon@barberking.pe", "Jhon Segales");

console.log("Listo.");
