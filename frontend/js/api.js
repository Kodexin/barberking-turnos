// Capa Cliente: helpers compartidos para hablar con la API y manejar la sesión.
const API_BASE = "/api";

const Sesion = {
  guardar(token, usuario) {
    localStorage.setItem("bk_token", token);
    localStorage.setItem("bk_usuario", JSON.stringify(usuario));
  },
  token() {
    return localStorage.getItem("bk_token");
  },
  usuario() {
    const raw = localStorage.getItem("bk_usuario");
    return raw ? JSON.parse(raw) : null;
  },
  cerrar() {
    localStorage.removeItem("bk_token");
    localStorage.removeItem("bk_usuario");
    window.location.href = "/index.html";
  },
  /** Redirige a index si no hay sesión, o si el rol no es el esperado. Devuelve el usuario. */
  exigir(rolEsperado) {
    const usuario = Sesion.usuario();
    if (!usuario || !Sesion.token()) {
      window.location.href = "/index.html";
      return null;
    }
    if (rolEsperado && usuario.rol !== rolEsperado) {
      window.location.href = destinoPorRol(usuario.rol);
      return null;
    }
    return usuario;
  },
};

function destinoPorRol(rol) {
  if (rol === "cliente") return "/cliente.html";
  if (rol === "barbero") return "/barbero.html";
  if (rol === "administrador") return "/admin.html";
  return "/index.html";
}

async function api(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth && Sesion.token()) headers.Authorization = `Bearer ${Sesion.token()}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    /* respuesta sin cuerpo */
  }

  if (!res.ok) {
    const error = new Error((data && data.error) || `Error ${res.status}`);
    error.status = res.status;
    throw error;
  }
  return data;
}

function mostrarToast(mensaje, tipo = "info") {
  const el = document.createElement("div");
  el.className = `toast ${tipo === "error" ? "error" : tipo === "success" ? "success" : ""}`;
  el.textContent = mensaje;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3800);
}

function formatoFechaLarga(fechaISO) {
  const [y, m, d] = fechaISO.split("-").map(Number);
  const fecha = new Date(y, m - 1, d);
  return fecha.toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" });
}

function formatoMoneda(valor) {
  return `S/ ${Number(valor).toFixed(2)}`;
}

function hoyISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset();
  const local = new Date(d.getTime() - tz * 60000);
  return local.toISOString().slice(0, 10);
}
