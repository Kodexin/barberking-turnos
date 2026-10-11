// Módulo de Notificaciones (RF04).
//
// IMPORTANTE: este servicio está SIMULADO a propósito. Enviar correos o mensajes de
// WhatsApp reales requiere credenciales de un proveedor (SMTP, API de WhatsApp Business,
// etc.) que este proyecto académico no tiene configuradas. En su lugar, cada notificación
// se registra en la tabla `notificaciones` y se imprime en consola, dejando el "contrato"
// (mismo nombre de función, mismo mensaje) listo para conectar un proveedor real más
// adelante sin tener que tocar el resto del sistema (así se documentó en "Mantenimiento
// y evolución" del Beat Chart).
const db = require("../db");

function construirMensaje(tipo, cita) {
  const base = `Cita con ${cita.barbero_nombre} (${cita.servicio_nombre}) el ${cita.fecha} a las ${cita.hora_inicio}.`;
  if (tipo === "confirmacion") return `Tu cita fue confirmada. ${base}`;
  if (tipo === "recordatorio") return `Recordatorio: tienes una cita pronto. ${base}`;
  if (tipo === "cancelacion") return `Tu cita fue cancelada. ${base}`;
  return base;
}

/**
 * Registra y "envía" (simulado) una notificación asociada a una cita.
 * @param {"confirmacion"|"recordatorio"|"cancelacion"} tipo
 * @param {object} cita fila de citas enriquecida con barbero_nombre y servicio_nombre
 */
function notificar(tipo, cita) {
  const mensaje = construirMensaje(tipo, cita);
  db.prepare(
    "INSERT INTO notificaciones (cita_id, tipo, canal, mensaje) VALUES (?,?,?,?)"
  ).run(cita.id, tipo, "simulado (correo/WhatsApp)", mensaje);

  // Stand-in de un envío real: en producción aquí iría, por ejemplo,
  // nodemailer.sendMail(...) o una llamada a la API de WhatsApp Business.
  console.log(`[Notificaciones] (${tipo.toUpperCase()}) -> ${mensaje}`);

  return mensaje;
}

module.exports = { notificar };
