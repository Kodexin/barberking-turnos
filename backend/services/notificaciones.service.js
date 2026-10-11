// Módulo de Notificaciones (RF04).
//
// Cada notificación se registra en la tabla `notificaciones` y se envía por correo
// real al cliente (Gmail SMTP, ver email.service.js). Si el envío falla o el correo
// no está configurado, la cita NO se ve afectada: solo se deja constancia del canal
// y del error en el registro.
const db = require("../db");
const { enviarCorreo } = require("./email.service");

const ASUNTOS = {
  confirmacion: "Cita confirmada - BarberKing Turnos",
  recordatorio: "Recordatorio de tu cita - BarberKing Turnos",
  cancelacion: "Cita cancelada - BarberKing Turnos",
};

function construirMensaje(tipo, cita) {
  const base = `Cita con ${cita.barbero_nombre} (${cita.servicio_nombre}) el ${cita.fecha} a las ${cita.hora_inicio}.`;
  if (tipo === "confirmacion") return `Tu cita fue confirmada. ${base}`;
  if (tipo === "recordatorio") return `Recordatorio: tienes una cita pronto. ${base}`;
  if (tipo === "cancelacion") return `Tu cita fue cancelada. ${base}`;
  return base;
}

/**
 * Registra y envía una notificación por correo al cliente de la cita.
 * @param {"confirmacion"|"recordatorio"|"cancelacion"} tipo
 * @param {object} cita fila de citas enriquecida (barbero_nombre, servicio_nombre, cliente_nombre, cliente_email)
 * @returns {Promise<{mensaje: string, enviado: boolean, destino: string|null, error?: string}>}
 */
async function notificar(tipo, cita) {
  const mensaje = construirMensaje(tipo, cita);
  const texto = `Hola ${cita.cliente_nombre || ""},\n\n${mensaje}\n\nBarberKing Turnos`;

  const resultado = await enviarCorreo({
    para: cita.cliente_email,
    asunto: ASUNTOS[tipo] || "BarberKing Turnos",
    texto,
  });

  const canal = resultado.enviado ? "correo" : `correo (no enviado: ${resultado.error})`;
  db.prepare("INSERT INTO notificaciones (cita_id, tipo, canal, mensaje) VALUES (?,?,?,?)").run(
    cita.id,
    tipo,
    canal,
    mensaje
  );

  console.log(
    `[Notificaciones] (${tipo.toUpperCase()}) -> ${cita.cliente_email || "sin correo"} | ${
      resultado.enviado ? "ENVIADO" : "NO ENVIADO: " + resultado.error
    }`
  );

  return {
    mensaje,
    enviado: resultado.enviado,
    destino: cita.cliente_email || null,
    error: resultado.error,
  };
}

module.exports = { notificar };
