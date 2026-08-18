const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data.db');

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');

db.exec(`
  CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_name TEXT NOT NULL,
    patient_phone TEXT NOT NULL,
    start_at TEXT NOT NULL,      -- ISO 8601, ej. 2026-08-20T10:30:00
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    reason TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'confirmed', -- confirmed | cancelled | completed
    whatsapp_status TEXT NOT NULL DEFAULT 'pending', -- pending | sent | failed | skipped
    whatsapp_error TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_appointments_start_at ON appointments(start_at);
`);

module.exports = db;
