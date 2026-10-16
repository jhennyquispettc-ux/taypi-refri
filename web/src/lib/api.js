// Envoltorio de fetch: agrega el token JWT y maneja la sesión expirada (401)
import { API_URL } from '../config.js';

const CLAVE_TOKEN = 'taypi_token';
const CLAVE_USUARIO = 'taypi_usuario';

// localStorage puede fallar (modo privado, etc.), por eso todo va en try/catch
export const sesion = {
  token() {
    try { return localStorage.getItem(CLAVE_TOKEN); } catch { return null; }
  },
  usuario() {
    try { return JSON.parse(localStorage.getItem(CLAVE_USUARIO)); } catch { return null; }
  },
  guardar(token, usuario) {
    try {
      if (token) localStorage.setItem(CLAVE_TOKEN, token);
      localStorage.setItem(CLAVE_USUARIO, JSON.stringify(usuario));
    } catch { /* sin almacenamiento: la sesión dura lo que dure la pestaña */ }
  },
  borrar() {
    try {
      localStorage.removeItem(CLAVE_TOKEN);
      localStorage.removeItem(CLAVE_USUARIO);
    } catch { /* nada */ }
  },
};

// useAuth registra aquí qué hacer cuando el backend responde 401
let alExpirar = () => {};
export function alExpirarSesion(fn) {
  alExpirar = fn;
}

export class ErrorApi extends Error {
  constructor(status, datos) {
    super(datos?.error ?? mensajePorStatus(status));
    this.status = status;
    this.datos = datos;
  }
}

function mensajePorStatus(status) {
  if (status === 0) return 'No se pudo conectar con el servidor. Revisa tu conexión.';
  if (status === 401) return 'Tu sesión expiró. Vuelve a ingresar.';
  if (status === 403) return 'No tienes permiso para ver esto.';
  if (status === 404) return 'No encontrado.';
  return 'Ocurrió un error en el servidor.';
}

// api('/estado'), api('/turno', { method: 'POST' }), api('/admin/cuentas/3', { method: 'PATCH', body: {...} })
export async function api(ruta, { method = 'GET', body } = {}) {
  const token = sesion.token();
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(`${API_URL}/api${ruta}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ErrorApi(0, null);
  }

  const datos = await res.json().catch(() => null);
  if (res.status === 401 && token) alExpirar(); // token vencido o usuario borrado
  if (!res.ok) throw new ErrorApi(res.status, datos);
  return datos;
}
