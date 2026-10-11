# BarberKing Turnos

Sistema de Gestión de Turnos y Citas para barbería, desarrollado como proyecto
de la primera unidad (ACS1, DV1, DV2 y Beat Chart).

## Stack

- Backend: Node.js + Express + SQLite (better-sqlite3)
- Frontend: HTML + CSS + JavaScript (sin frameworks), servido por el mismo backend
- Autenticación: JWT + bcrypt

## Módulos (según el diagrama de descomposición funcional del DV2)

1. **Autenticación** — registro/login de cliente, barbero y administrador (RF01)
2. **Reservas y Agenda** — disponibilidad en tiempo real, reserva, reprogramación,
   cancelación y agenda del barbero (RF02, RF03)
3. **Notificaciones** — confirmación y recordatorio (simulado: se registra en BD
   y se imprime en consola; listo para conectar un proveedor real de correo/WhatsApp) (RF04)
4. **Reportes** — ingresos, ocupación por barbero y clientes frecuentes (RF05)

## Cómo ejecutarlo

```bash
npm install
cp .env.example .env     # define JWT_SECRET
npm run seed              # crea usuarios y servicios de ejemplo
npm start                 # http://localhost:3000
```

## Credenciales de prueba (creadas por `npm run seed`)

| Rol           | Correo                  | Contraseña  |
|---------------|--------------------------|-------------|
| Administrador | admin@barberking.pe      | admin123    |
| Barbero       | jhon@barberking.pe       | barbero123  |
| Barbero       | luis@barberking.pe       | barbero123  |
| Cliente       | cliente@demo.pe          | cliente123  |

También puedes crear una cuenta de cliente nueva desde la pantalla de login
("Crear cuenta").

## Reglas de negocio clave

- La duración de cada cita la define el **servicio** elegido (no es fija por
  barbero ni se calcula con IA), tal como se definió en el DV2.
- Se deja un margen (buffer) de 10 minutos entre citas para absorber pequeños
  retrasos.
- El horario de atención es de 09:00 a 19:00.
- El cobro del servicio sigue siendo manual (fuera de alcance, según el DV2);
  el sistema solo refleja ingresos de citas marcadas como "atendida".

## Estructura

```
backend/
  server.js                 servidor Express (capa de lógica de negocio)
  db.js                     esquema SQLite (capa de datos)
  seed.js                   datos de ejemplo
  middleware/auth.js        validación de JWT y roles
  routes/                   endpoints por módulo funcional
  services/notificaciones.service.js
  utils/disponibilidad.js   cálculo de horarios disponibles
frontend/
  index.html                login / registro
  cliente.html               reservar citas + ver mis citas
  barbero.html                agenda del día
  admin.html                   reportes + alta de barberos/servicios
  css/style.css
  js/api.js
```
