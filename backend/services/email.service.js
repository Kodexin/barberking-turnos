// Envío real de correos vía Resend (API HTTPS, https://resend.com).
//
// Se usa Resend en lugar de SMTP directo porque Railway bloquea los puertos
// SMTP salientes (465/587) en los planes Free/Trial/Hobby; solo los habilita
// en el plan Pro. Resend envía por HTTPS (puerto 443), que nunca se bloquea.
//
// Variables de entorno requeridas:
//   RESEND_API_KEY -> API key generada en https://resend.com/api-keys
//   RESEND_FROM    -> opcional. Dirección "from". Si no se configura un
//                     dominio propio verificado en Resend, se usa el
//                     remitente de pruebas "onboarding@resend.dev", que
//                     funciona sin verificar nada pero se ve menos
//                     profesional (sirve perfecto para esta demo).
//
// Si falta la API key, el envío se omite con un aviso en consola (el sistema
// sigue funcionando).
const RESEND_API_URL = "https://api.resend.com/emails";

/**
 * Envía un correo. Devuelve { enviado: boolean, error?: string }. Nunca lanza.
 */
async function enviarCorreo({ para, asunto, texto }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[Email] RESEND_API_KEY no configurada: no se envió el correo.");
    return { enviado: false, error: "Correo no configurado en el servidor." };
  }
  if (!para) return { enviado: false, error: "El cliente no tiene correo registrado." };

  const from = process.env.RESEND_FROM || "BarberKing Turnos <onboarding@resend.dev>";

  try {
    const resp = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: para, subject: asunto, text: texto }),
    });

    if (!resp.ok) {
      const cuerpo = await resp.text().catch(() => "");
      let detalle = cuerpo;
      try {
        detalle = JSON.parse(cuerpo).message || cuerpo;
      } catch (_) {}
      return { enviado: false, error: `Resend ${resp.status}: ${detalle}` };
    }

    return { enviado: true };
  } catch (err) {
    console.error("[Email] Error al enviar:", err.message);
    return { enviado: false, error: err.message };
  }
}

module.exports = { enviarCorreo };
