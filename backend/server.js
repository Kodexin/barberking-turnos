// Servidor de Aplicación (capa de Lógica de Negocio del diagrama de arquitectura).
// Expone la API REST que consume el frontend (capa Cliente).
require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");

if (!process.env.JWT_SECRET) {
  console.error("Falta JWT_SECRET. Copia .env.example como .env y define un valor.");
  process.exit(1);
}

const { router: authRouter } = require("./routes/auth.routes");
const serviciosRouter = require("./routes/servicios.routes");
const citasRouter = require("./routes/citas.routes");
const reportesRouter = require("./routes/reportes.routes");

const app = express();
app.use(cors());
app.use(express.json());

// --- Módulos funcionales (ver DV2: diagrama de descomposición funcional) ---
app.use("/api/auth", authRouter); // Módulo de Autenticación
app.use("/api/servicios", serviciosRouter); // catálogo (apoya a Reservas y Agenda)
app.use("/api/citas", citasRouter); // Módulo de Reservas y Agenda (+ dispara Notificaciones)
app.use("/api/reportes", reportesRouter); // Módulo de Reportes

app.get("/api/salud", (req, res) => {
  res.json({ ok: true, servicio: "BarberKing Turnos API" });
});

// --- Frontend estático (capa Cliente servida desde el mismo servidor para simplificar) ---
app.use(express.static(path.join(__dirname, "..", "frontend")));

// Manejador de errores no esperados (para no filtrar detalles internos al cliente).
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor." });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`BarberKing Turnos escuchando en http://localhost:${PORT}`);
});
