// Módulo de acceso a datos (capa de Base de Datos del diagrama de arquitectura).
// Usa SQLite en archivo -> no requiere instalar/configurar un servidor de BD aparte,
// cumple la restricción económica/técnica definida en el DV1 (hosting y stack de bajo costo).
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, "barberking.db");
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  rol TEXT NOT NULL CHECK (rol IN ('cliente','barbero','administrador')),
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS servicios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  duracion_min INTEGER NOT NULL,
  precio REAL NOT NULL,
  activo INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS citas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id INTEGER NOT NULL REFERENCES usuarios(id),
  barbero_id INTEGER NOT NULL REFERENCES usuarios(id),
  servicio_id INTEGER NOT NULL REFERENCES servicios(id),
  fecha TEXT NOT NULL,        -- YYYY-MM-DD
  hora_inicio TEXT NOT NULL,  -- HH:MM
  hora_fin TEXT NOT NULL,     -- HH:MM
  estado TEXT NOT NULL DEFAULT 'confirmada'
    CHECK (estado IN ('confirmada','atendida','cancelada')),
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notificaciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cita_id INTEGER NOT NULL REFERENCES citas(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('confirmacion','recordatorio','cancelacion')),
  canal TEXT NOT NULL DEFAULT 'simulado',
  mensaje TEXT NOT NULL,
  enviado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_citas_barbero_fecha ON citas(barbero_id, fecha);
CREATE INDEX IF NOT EXISTS idx_citas_cliente ON citas(cliente_id);
`);

module.exports = db;
