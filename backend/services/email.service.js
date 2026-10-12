// Envío real de correos vía Brevo (API HTTPS, https://www.brevo.com).
//
// Se usa una API HTTPS (no SMTP) porque Railway bloquea los puertos SMTP
// salientes (465/587) en los planes Free/Trial/Hobby; Brevo envía por
// HTTPS (puerto 443), que nunca se bloquea.
//
// A diferencia de Resend, Brevo NO exige un dominio propio verificado para
// enviar a cualquier destinatario: basta con verificar un único correo
// remitente (Senders & IP -> Senders -> Add a sender, confirmando con el
// enlace que llega a ese correo). Una vez verificado ese remitente, se puede
// enviar a cualquier "to" sin restricciones (300 correos/día gratis).
//
// Variables de entorno requeridas:
//   BREVO_API_KEY    -> generada en Brevo: Settings -> SMTP & API -> API Keys
//   BREVO_FROM_EMAIL -> el correo remitente verificado en Brevo (paso de
//                       "Senders"), ej. tuusuario@gmail.com
//   BREVO_FROM_NOMBRE -> opcional, nombre a mostrar (por defecto "BarberKing Turnos")
//
// Si falta la API key o el remitente, el envío se omite con un aviso en
// consola (el sistema sigue funcionando).
const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

/**
 * Envía un correo. Devuelve { enviado: boolean, error?: string }. Nunca lanza.
 */
async function enviarCorreo({ para, asunto, texto }) {
  const apiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.BREVO_FROM_EMAIL;

  if (!apiKey) {
    console.warn("[Email] BREVO_API_KEY no configurada: no se envió el correo.");
    return { enviado: false, error: "Correo no configurado en el servidor." };
  }
  if (!fromEmail) {
    console.warn("[Email] BREVO_FROM_EMAIL no configurada: no se envió el correo.");
    return { enviado: false, error: "Remitente de correo no configurado en el servidor." };
  }
  if (!para) return { enviado: false, error: "El cliente no tiene correo registrado." };

  const fromNombre = process.env.BREVO_FROM_NOMBRE || "BarberKing Turnos";

  try {
    const resp = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: { name: fromNombre, email: fromEmail },
        to: [{ email: para }],
        subject: asunto,
        textContent: texto,
      }),
    });

    if (!resp.ok) {
      const cuerpo = await resp.text().catch(() => "");
      let detalle = cuerpo;
      try {
        detalle = JSON.parse(cuerpo).message || cuerpo;
      } catch (_) {}
      return { enviado: false, error: `Brevo ${resp.status}: ${detalle}` };
    }

    return { enviado: true };
  } catch (err) {
    console.error("[Email] Error al enviar:", err.message);
    return { enviado: false, error: err.message };
  }
}

module.exports = { enviarCorreo };
