// Envío real de correos vía Gmail SMTP (nodemailer).
//
// Requiere dos variables de entorno:
//   GMAIL_USER          -> la cuenta de Gmail desde la que se envía (ej. barberking.turnos@gmail.com)
//   GMAIL_APP_PASSWORD  -> "contraseña de aplicación" de 16 caracteres generada en la cuenta de Google
//                          (no es la contraseña normal; requiere verificación en 2 pasos activada).
//
// Si faltan, el envío se omite con un aviso en consola (el sistema sigue funcionando).
const nodemailer = require("nodemailer");

let transporter = null;

function obtenerTransporter() {
  if (transporter) return transporter;
  const user = process.env.GMAIL_USER;
  const pass = (process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, "");
  if (!user || !pass) return null;
  transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
  return transporter;
}

/**
 * Envía un correo. Devuelve { enviado: boolean, error?: string }. Nunca lanza.
 */
async function enviarCorreo({ para, asunto, texto }) {
  const t = obtenerTransporter();
  if (!t) {
    console.warn("[Email] GMAIL_USER / GMAIL_APP_PASSWORD no configurados: no se envió el correo.");
    return { enviado: false, error: "Correo no configurado en el servidor." };
  }
  if (!para) return { enviado: false, error: "El cliente no tiene correo registrado." };
  try {
    await t.sendMail({
      from: `"BarberKing Turnos" <${process.env.GMAIL_USER}>`,
      to: para,
      subject: asunto,
      text: texto,
    });
    return { enviado: true };
  } catch (err) {
    console.error("[Email] Error al enviar:", err.message);
    return { enviado: false, error: err.message };
  }
}

module.exports = { enviarCorreo };
