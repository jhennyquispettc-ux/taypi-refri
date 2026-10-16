// Login con Google (Google Identity Services) + JWT propio
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { query } from './db.js';

let config = null;
let verificador = null;

export function configurarAuth(cfg) {
  config = cfg;
  const cliente = new OAuth2Client(cfg.googleClientId);
  // Verifica la firma del ID token de Google y que sea para nuestra app
  verificador = async (credential) => {
    const ticket = await cliente.verifyIdToken({ idToken: credential, audience: cfg.googleClientId });
    return ticket.getPayload();
  };
}

// Solo para pruebas
export function usarVerificador(fn) {
  verificador = fn;
}

// POST /api/auth/google { credential }
export async function loginGoogle(credential) {
  const datos = await verificador(credential); // lanza error si el token no es válido
  if (!datos?.sub || !datos.email || datos.email_verified === false) {
    throw Object.assign(new Error('Cuenta de Google no válida'), { status: 401 });
  }
  const { rows } = await query(
    `insert into usuarios (google_sub, email, nombre, foto_url)
     values ($1, $2, $3, $4)
     on conflict (google_sub) do update
       set email = excluded.email, nombre = excluded.nombre, foto_url = excluded.foto_url
     returning id, email, nombre, foto_url, rol`,
    [datos.sub, datos.email, datos.name ?? datos.email, datos.picture ?? null],
  );
  const usuario = rows[0];
  const token = jwt.sign({ sub: usuario.id }, config.jwtSecret, { expiresIn: '7d' });
  return { token, usuario };
}

// Middleware: exige "Authorization: Bearer <jwt>" y carga el usuario (con su rol actual)
export async function autenticar(req, res, next) {
  try {
    const token = (req.headers.authorization ?? '').replace(/^Bearer /, '');
    const { sub } = jwt.verify(token, config.jwtSecret);
    const { rows } = await query(
      'select id, email, nombre, foto_url, rol from usuarios where id = $1',
      [sub],
    );
    if (!rows[0]) return res.status(401).json({ error: 'Usuario no encontrado' });
    req.usuario = rows[0];
    next();
  } catch {
    res.status(401).json({ error: 'Sesión inválida o expirada' });
  }
}

export function soloAdmin(req, res, next) {
  if (req.usuario?.rol !== 'admin') return res.status(403).json({ error: 'Solo administradores' });
  next();
}

// Middleware del ESP32: header x-device-key
export function autenticarDispositivo(req, res, next) {
  const recibida = Buffer.from(String(req.headers['x-device-key'] ?? ''));
  const esperada = Buffer.from(config.deviceKey);
  if (recibida.length !== esperada.length || !crypto.timingSafeEqual(recibida, esperada)) {
    return res.status(401).json({ error: 'Dispositivo no autorizado' });
  }
  next();
}
