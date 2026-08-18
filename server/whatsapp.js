// Integracion con Meta WhatsApp Cloud API
// Documentacion oficial: https://developers.facebook.com/docs/whatsapp/cloud-api

const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const API_VERSION = process.env.WHATSAPP_API_VERSION || 'v20.0';
const TEMPLATE_NAME = process.env.WHATSAPP_TEMPLATE_NAME || 'cita_confirmacion';
const TEMPLATE_LANG = process.env.WHATSAPP_TEMPLATE_LANG || 'es_MX';
const DEFAULT_COUNTRY_CODE = process.env.DEFAULT_COUNTRY_CODE || '52';

function isConfigured() {
  return Boolean(TOKEN && PHONE_NUMBER_ID);
}

// Normaliza un telefono capturado en el formulario a formato E.164 sin '+'
// (que es lo que espera la Cloud API), anteponiendo la lada por defecto
// si el usuario no la incluyo.
function normalizePhone(rawPhone) {
  const digitsOnly = String(rawPhone || '').replace(/[^0-9]/g, '');
  if (!digitsOnly) return null;

  // Si ya trae 11-15 digitos asumimos que incluye codigo de pais.
  if (digitsOnly.length >= 11) return digitsOnly;

  return `${DEFAULT_COUNTRY_CODE}${digitsOnly}`;
}

function formatDateForMessage(isoString) {
  const d = new Date(isoString);
  const fecha = d.toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: process.env.TZ || 'America/Mexico_City',
  });
  const hora = d.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: process.env.TZ || 'America/Mexico_City',
  });
  return { fecha, hora };
}

/**
 * Envia el mensaje de confirmacion de cita usando una plantilla (template)
 * previamente aprobada en Meta Business Manager. Se usa plantilla (y no texto
 * libre) porque WhatsApp exige plantillas aprobadas para mensajes que inicia
 * el negocio fuera de una conversacion activa de 24h.
 *
 * La plantilla debe tener 3 variables de cuerpo en este orden:
 *   {{1}} nombre del paciente
 *   {{2}} fecha
 *   {{3}} hora
 */
async function sendAppointmentConfirmation({ patientName, patientPhone, startAt }) {
  if (!isConfigured()) {
    return { ok: false, skipped: true, error: 'WHATSAPP_TOKEN o WHATSAPP_PHONE_NUMBER_ID no configurados' };
  }

  const to = normalizePhone(patientPhone);
  if (!to) {
    return { ok: false, error: 'Numero de telefono invalido' };
  }

  const { fecha, hora } = formatDateForMessage(startAt);

  const url = `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/messages`;

  const body = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: TEMPLATE_NAME,
      language: { code: TEMPLATE_LANG },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: patientName },
            { type: 'text', text: fecha },
            { type: 'text', text: hora },
          ],
        },
      ],
    },
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      const errMsg = data?.error?.message || `HTTP ${res.status}`;
      return { ok: false, error: errMsg, raw: data };
    }

    return { ok: true, messageId: data?.messages?.[0]?.id, raw: data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = {
  isConfigured,
  normalizePhone,
  sendAppointmentConfirmation,
};
