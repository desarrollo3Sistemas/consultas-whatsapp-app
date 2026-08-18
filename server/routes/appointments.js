const express = require('express');
const db = require('../db');
const whatsapp = require('../whatsapp');

const router = express.Router();

function serialize(row) {
  return row;
}

// GET /api/appointments?from=ISO&to=ISO
router.get('/', (req, res) => {
  const { from, to } = req.query;
  let rows;
  if (from && to) {
    rows = db
      .prepare(
        `SELECT * FROM appointments WHERE start_at >= ? AND start_at <= ? AND status != 'cancelled' ORDER BY start_at ASC`
      )
      .all(from, to);
  } else {
    rows = db.prepare(`SELECT * FROM appointments ORDER BY start_at ASC`).all();
  }
  res.json(rows.map(serialize));
});

// GET /api/appointments/:id
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Cita no encontrada' });
  res.json(row);
});

// POST /api/appointments
router.post('/', async (req, res) => {
  const { patient_name, patient_phone, start_at, duration_minutes, reason, notes } = req.body;

  if (!patient_name || !patient_phone || !start_at) {
    return res.status(400).json({ error: 'patient_name, patient_phone y start_at son obligatorios' });
  }

  const info = db
    .prepare(
      `INSERT INTO appointments (patient_name, patient_phone, start_at, duration_minutes, reason, notes)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      patient_name.trim(),
      patient_phone.trim(),
      start_at,
      duration_minutes || 30,
      reason || null,
      notes || null
    );

  const appointment = db.prepare('SELECT * FROM appointments WHERE id = ?').get(info.lastInsertRowid);

  // Enviar confirmacion por WhatsApp (no bloqueante para la respuesta si falla)
  const result = await whatsapp.sendAppointmentConfirmation({
    patientName: appointment.patient_name,
    patientPhone: appointment.patient_phone,
    startAt: appointment.start_at,
  });

  const whatsappStatus = result.ok ? 'sent' : result.skipped ? 'skipped' : 'failed';
  db.prepare('UPDATE appointments SET whatsapp_status = ?, whatsapp_error = ?, updated_at = datetime(\'now\') WHERE id = ?').run(
    whatsappStatus,
    result.ok ? null : result.error || null,
    appointment.id
  );

  const updated = db.prepare('SELECT * FROM appointments WHERE id = ?').get(appointment.id);
  res.status(201).json({ appointment: updated, whatsapp: result });
});

// PUT /api/appointments/:id
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Cita no encontrada' });

  const fields = ['patient_name', 'patient_phone', 'start_at', 'duration_minutes', 'reason', 'notes', 'status'];
  const updates = {};
  for (const f of fields) {
    if (req.body[f] !== undefined) updates[f] = req.body[f];
  }

  const setClause = Object.keys(updates)
    .map((k) => `${k} = @${k}`)
    .join(', ');

  if (setClause) {
    db.prepare(`UPDATE appointments SET ${setClause}, updated_at = datetime('now') WHERE id = @id`).run({
      ...updates,
      id: req.params.id,
    });
  }

  const updated = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// POST /api/appointments/:id/cancel
router.post('/:id/cancel', (req, res) => {
  const existing = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Cita no encontrada' });

  db.prepare("UPDATE appointments SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?").run(req.params.id);
  const updated = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// DELETE /api/appointments/:id
router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Cita no encontrada' });

  db.prepare('DELETE FROM appointments WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

// POST /api/appointments/:id/resend-whatsapp
router.post('/:id/resend-whatsapp', async (req, res) => {
  const appointment = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
  if (!appointment) return res.status(404).json({ error: 'Cita no encontrada' });

  const result = await whatsapp.sendAppointmentConfirmation({
    patientName: appointment.patient_name,
    patientPhone: appointment.patient_phone,
    startAt: appointment.start_at,
  });

  const whatsappStatus = result.ok ? 'sent' : result.skipped ? 'skipped' : 'failed';
  db.prepare('UPDATE appointments SET whatsapp_status = ?, whatsapp_error = ?, updated_at = datetime(\'now\') WHERE id = ?').run(
    whatsappStatus,
    result.ok ? null : result.error || null,
    appointment.id
  );

  res.json({ whatsapp: result });
});

module.exports = router;
