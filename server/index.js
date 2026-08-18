require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');

const appointmentsRouter = require('./routes/appointments');
const whatsapp = require('./whatsapp');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api/appointments', appointmentsRouter);

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    whatsappConfigured: whatsapp.isConfigured(),
    time: new Date().toISOString(),
  });
});

// Frontend estatico
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor de consultas escuchando en http://localhost:${PORT}`);
  if (!whatsapp.isConfigured()) {
    console.warn(
      'AVISO: WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID no configurados. Las citas se crearan pero no se enviaran confirmaciones por WhatsApp.'
    );
  }
});
