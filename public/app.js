const API_BASE = '/api/appointments';

let calendar;
let currentAppointment = null; // null = creando nueva

document.addEventListener('DOMContentLoaded', () => {
  initCalendar();
  wireUpForm();
  checkWhatsappStatus();
});

function checkWhatsappStatus() {
  fetch('/api/health')
    .then((r) => r.json())
    .then((data) => {
      const el = document.getElementById('whatsappStatus');
      if (data.whatsappConfigured) {
        el.textContent = 'WhatsApp conectado';
        el.style.color = '#128C7E';
      } else {
        el.textContent = 'WhatsApp NO configurado (revisa el archivo .env)';
        el.style.color = '#d64545';
      }
    })
    .catch(() => {});
}

function initCalendar() {
  const calendarEl = document.getElementById('calendar');
  calendar = new FullCalendar.Calendar(calendarEl, {
    locale: 'es',
    initialView: 'timeGridWeek',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay',
    },
    slotMinTime: '07:00:00',
    slotMaxTime: '21:00:00',
    height: 'auto',
    nowIndicator: true,
    selectable: true,
    events: fetchEvents,
    select: (info) => openModalForCreate(info.startStr),
    eventClick: (info) => openModalForEdit(info.event.id),
  });
  calendar.render();

  document.getElementById('newAppointmentBtn').addEventListener('click', () => openModalForCreate());
}

function fetchEvents(fetchInfo, successCallback, failureCallback) {
  const from = fetchInfo.startStr;
  const to = fetchInfo.endStr;
  fetch(`${API_BASE}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
    .then((r) => r.json())
    .then((rows) => {
      const events = rows.map((a) => ({
        id: String(a.id),
        title: `${a.patient_name}${a.reason ? ' · ' + a.reason : ''}`,
        start: a.start_at,
        end: addMinutes(a.start_at, a.duration_minutes),
        classNames: a.status === 'cancelled' ? ['fc-event-cancelled'] : [],
        extendedProps: a,
      }));
      successCallback(events);
    })
    .catch(failureCallback);
}

function addMinutes(isoString, minutes) {
  const d = new Date(isoString);
  d.setMinutes(d.getMinutes() + Number(minutes || 30));
  return d.toISOString();
}

function wireUpForm() {
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('closeFormBtn').addEventListener('click', closeModal);
  document.getElementById('modalOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'modalOverlay') closeModal();
  });

  document.getElementById('appointmentForm').addEventListener('submit', onSubmit);
  document.getElementById('cancelAppointmentBtn').addEventListener('click', onCancelAppointment);
  document.getElementById('resendWhatsappBtn').addEventListener('click', onResendWhatsapp);

  ['patientName', 'apptDate', 'apptTime'].forEach((id) => {
    document.getElementById(id).addEventListener('input', updateWhatsappPreview);
  });
}

function openModalForCreate(startStr) {
  currentAppointment = null;
  document.getElementById('modalTitle').textContent = 'Nueva cita';
  document.getElementById('appointmentId').value = '';
  document.getElementById('patientName').value = '';
  document.getElementById('patientPhone').value = '';
  document.getElementById('apptReason').value = '';
  document.getElementById('apptNotes').value = '';
  document.getElementById('apptDuration').value = 30;
  document.getElementById('formMessage').textContent = '';

  const d = startStr ? new Date(startStr) : new Date();
  document.getElementById('apptDate').value = toDateInputValue(d);
  document.getElementById('apptTime').value = toTimeInputValue(d);

  document.getElementById('cancelAppointmentBtn').style.display = 'none';
  document.getElementById('resendWhatsappBtn').style.display = 'none';
  document.getElementById('saveBtn').textContent = 'Guardar y confirmar por WhatsApp';

  updateWhatsappPreview();
  openModal();
}

function openModalForEdit(id) {
  fetch(`${API_BASE}/${id}`)
    .then((r) => r.json())
    .then((a) => {
      currentAppointment = a;
      document.getElementById('modalTitle').textContent = 'Editar cita';
      document.getElementById('appointmentId').value = a.id;
      document.getElementById('patientName').value = a.patient_name;
      document.getElementById('patientPhone').value = a.patient_phone;
      document.getElementById('apptReason').value = a.reason || '';
      document.getElementById('apptNotes').value = a.notes || '';
      document.getElementById('apptDuration').value = a.duration_minutes;

      const d = new Date(a.start_at);
      document.getElementById('apptDate').value = toDateInputValue(d);
      document.getElementById('apptTime').value = toTimeInputValue(d);

      document.getElementById('cancelAppointmentBtn').style.display = a.status === 'cancelled' ? 'none' : 'inline-block';
      document.getElementById('resendWhatsappBtn').style.display = 'inline-block';
      document.getElementById('saveBtn').textContent = 'Guardar cambios';

      document.getElementById('formMessage').textContent = `Estado WhatsApp: ${describeWhatsappStatus(a.whatsapp_status)}`;
      document.getElementById('formMessage').className = 'form-message';

      updateWhatsappPreview();
      openModal();
    });
}

function describeWhatsappStatus(status) {
  switch (status) {
    case 'sent': return 'enviado ✅';
    case 'failed': return 'falló ❌ (revisa configuración)';
    case 'skipped': return 'omitido (WhatsApp no configurado)';
    default: return 'pendiente';
  }
}

function updateWhatsappPreview() {
  const name = document.getElementById('patientName').value || '(paciente)';
  const date = document.getElementById('apptDate').value;
  const time = document.getElementById('apptTime').value;
  let when = '(fecha/hora)';
  if (date && time) {
    const d = new Date(`${date}T${time}`);
    when = d.toLocaleString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  }
  document.getElementById('whatsappPreview').textContent =
    `📲 Mensaje que recibirá por WhatsApp:\n"Hola ${name}, tu cita ha sido confirmada para el ${when}."`;
}

function openModal() {
  document.getElementById('modalOverlay').classList.add('open');
}
function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
}

function toDateInputValue(d) {
  return d.toISOString().slice(0, 10) === 'Invalid Da' ? '' : localISODate(d);
}
function localISODate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
function toTimeInputValue(d) {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function onSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('appointmentId').value;
  const date = document.getElementById('apptDate').value;
  const time = document.getElementById('apptTime').value;
  const start_at = new Date(`${date}T${time}`).toISOString();

  const payload = {
    patient_name: document.getElementById('patientName').value.trim(),
    patient_phone: document.getElementById('patientPhone').value.trim(),
    start_at,
    duration_minutes: Number(document.getElementById('apptDuration').value) || 30,
    reason: document.getElementById('apptReason').value.trim(),
    notes: document.getElementById('apptNotes').value.trim(),
  };

  const msgEl = document.getElementById('formMessage');
  msgEl.textContent = 'Guardando...';
  msgEl.className = 'form-message';

  const isEdit = Boolean(id);
  const url = isEdit ? `${API_BASE}/${id}` : API_BASE;
  const method = isEdit ? 'PUT' : 'POST';

  fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
    .then(async (r) => {
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Error al guardar');
      return data;
    })
    .then((data) => {
      if (!isEdit) {
        const wa = data.whatsapp;
        if (wa && wa.ok) {
          msgEl.textContent = 'Cita creada y mensaje de WhatsApp enviado ✅';
          msgEl.className = 'form-message success';
        } else if (wa && wa.skipped) {
          msgEl.textContent = 'Cita creada. WhatsApp no está configurado todavía.';
          msgEl.className = 'form-message';
        } else {
          msgEl.textContent = `Cita creada, pero el WhatsApp falló: ${wa ? wa.error : 'error desconocido'}`;
          msgEl.className = 'form-message error';
        }
      } else {
        msgEl.textContent = 'Cambios guardados ✅';
        msgEl.className = 'form-message success';
      }
      calendar.refetchEvents();
      setTimeout(closeModal, isEdit ? 600 : 1400);
    })
    .catch((err) => {
      msgEl.textContent = err.message;
      msgEl.className = 'form-message error';
    });
}

function onCancelAppointment() {
  const id = document.getElementById('appointmentId').value;
  if (!id) return;
  if (!confirm('¿Cancelar esta cita? El paciente no recibirá aviso automático de la cancelación.')) return;

  fetch(`${API_BASE}/${id}/cancel`, { method: 'POST' })
    .then((r) => r.json())
    .then(() => {
      calendar.refetchEvents();
      closeModal();
    });
}

function onResendWhatsapp() {
  const id = document.getElementById('appointmentId').value;
  if (!id) return;
  const msgEl = document.getElementById('formMessage');
  msgEl.textContent = 'Reenviando mensaje...';
  msgEl.className = 'form-message';

  fetch(`${API_BASE}/${id}/resend-whatsapp`, { method: 'POST' })
    .then((r) => r.json())
    .then(({ whatsapp }) => {
      if (whatsapp.ok) {
        msgEl.textContent = 'Mensaje reenviado ✅';
        msgEl.className = 'form-message success';
      } else {
        msgEl.textContent = `No se pudo reenviar: ${whatsapp.error}`;
        msgEl.className = 'form-message error';
      }
    });
}
