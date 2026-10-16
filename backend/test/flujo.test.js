// Prueba de punta a punta: la API real contra PostgreSQL en memoria (PGlite).
// Ejecutar: npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import jwt from 'jsonwebtoken';
import { PGlite } from '@electric-sql/pglite';
import { usarAdaptador } from '../src/db.js';
import { configurarAuth, usarVerificador } from '../src/auth.js';
import { crearApp } from '../src/app.js';

const config = {
  jwtSecret: 'secreto-de-prueba',
  googleClientId: 'cliente-de-prueba',
  deviceKey: 'clave-esp32',
  webOrigins: ['http://localhost:5173'],
};

let db, servidor, base;
const pg = () => db;

before(async () => {
  db = new PGlite();
  await db.exec(fs.readFileSync(new URL('../../sql/esquema.sql', import.meta.url), 'utf8'));
  usarAdaptador(db);
  configurarAuth(config);
  // Simula Google: el "credential" es el email
  usarVerificador(async (cred) => ({ sub: 'g-' + cred, email: cred, name: cred.split('@')[0], email_verified: true }));
  servidor = crearApp(config).listen(0);
  base = `http://localhost:${servidor.address().port}/api`;
});
after(() => servidor.close());

async function api(metodo, ruta, { token, body, device } = {}) {
  const r = await fetch(base + ruta, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(device && { 'x-device-key': device }),
    },
    body: body && JSON.stringify(body),
  });
  return { status: r.status, data: await r.json() };
}
const esp = (ruta, body) => api('POST', '/dispositivo/' + ruta, { device: 'clave-esp32', body });
const login = async (email) => (await api('POST', '/auth/google', { body: { credential: email } })).data;
const vencerTurno = () => pg().query(`update turnos set expira_en = now() - interval '1 minute' where estado = 'pendiente'`);

let ana, beto, admin;

test('login con Google crea usuarios; el rol admin se asigna por SQL', async () => {
  ana = await login('ana@gmail.com');
  beto = await login('beto@gmail.com');
  const a = await login('admin@gmail.com');
  assert.equal(ana.usuario.rol, 'cliente');
  await pg().query(`update usuarios set rol = 'admin' where email = 'admin@gmail.com'`);
  admin = a;
  const yo = await api('GET', '/yo', { token: admin.token });
  assert.equal(yo.data.rol, 'admin');
});

test('rechaza token inválido, clave de dispositivo incorrecta y cliente en rutas admin', async () => {
  assert.equal((await api('GET', '/estado', { token: 'basura' })).status, 401);
  assert.equal((await api('POST', '/dispositivo/lectura', { device: 'mala', body: {} })).status, 401);
  assert.equal((await api('GET', '/admin/cuentas', { token: ana.token })).status, 403);
  const falso = jwt.sign({ sub: 9999 }, config.jwtSecret);
  assert.equal((await api('GET', '/yo', { token: falso })).status, 401);
});

test('lectura del ESP32 sin turno: LED rojo', async () => {
  const r = await esp('lectura', { botellas: 10, temperatura: 5.2, humedad: 60, puerta_abierta: false });
  assert.deepEqual(r.data, { turno: false, estado: 'libre', sin_usuario: false });
});

test('Ana pide turno: se crea su cuenta del día y Beto queda bloqueado', async () => {
  const r = await api('POST', '/turno', { token: ana.token });
  assert.equal(r.data.motivo, 'turno_asignado');
  assert.equal(r.data.segundos, 10);

  const b = await api('POST', '/turno', { token: beto.token });
  assert.equal(b.status, 409);
  assert.equal(b.data.motivo, 'ocupado');

  const e = await api('GET', '/estado', { token: ana.token });
  assert.equal(e.data.refrigerador.en_uso, true);
  assert.equal(e.data.mi_turno.estado, 'pendiente');
  assert.equal(e.data.cuenta_hoy.bebidas, 0);

  const l = await esp('lectura', { botellas: 10, temperatura: 5, humedad: 60, puerta_abierta: false });
  assert.equal(l.data.turno, true); // LED verde
});

test('Ana abre, saca 2 y cierra: su cuenta suma 2 y se libera', async () => {
  assert.equal((await esp('apertura', { botellas: 10 })).data.identificado, true);
  assert.equal((await esp('apertura', { botellas: 10 })).data.repetido, true); // reintento
  const c = await esp('cierre', { botellas: 8 });
  assert.deepEqual(c.data, { ok: true, sacadas: 2, identificado: true });
  assert.equal((await esp('cierre', { botellas: 8 })).data.ignorado, true); // reintento repetido

  const e = await api('GET', '/estado', { token: ana.token });
  assert.equal(e.data.cuenta_hoy.bebidas, 2);
  assert.equal(e.data.refrigerador.en_uso, false);
  assert.equal(e.data.mi_turno, null);
});

test('si no abre a tiempo el turno expira y otro puede pedirlo', async () => {
  await api('POST', '/turno', { token: beto.token });
  await vencerTurno();
  const r = await api('POST', '/turno', { token: ana.token });
  assert.equal(r.data.motivo, 'turno_asignado');
  await vencerTurno();
});

test('corte a los 2 min: cobra, sigue bloqueado y el cierre real cobra lo que falte', async () => {
  await api('POST', '/turno', { token: beto.token });
  await esp('apertura', { botellas: 8 });
  assert.equal((await esp('corte', { botellas: 7 })).data.sacadas, 1);

  const otra = await api('POST', '/turno', { token: ana.token });
  assert.equal(otra.data.motivo, 'ocupado');

  const c = await esp('cierre', { botellas: 5 });
  assert.equal(c.data.sacadas, 3);
  const e = await api('GET', '/estado', { token: beto.token });
  assert.equal(e.data.cuenta_hoy.bebidas, 3);
});

test('devolución resta de la cuenta sin bajar de 0', async () => {
  await api('POST', '/turno', { token: beto.token });
  await esp('apertura', { botellas: 5 });
  await esp('cierre', { botellas: 10 }); // devolvió 5 pero solo debía 3
  const e = await api('GET', '/estado', { token: beto.token });
  assert.equal(e.data.cuenta_hoy.bebidas, 0);
});

test('apertura sin turno se registra sin usuario', async () => {
  const a = await esp('apertura', { botellas: 10 });
  assert.equal(a.data.identificado, false);
  const l = await esp('lectura', { botellas: 9, temperatura: 5, humedad: 60, puerta_abierta: true });
  assert.equal(l.data.sin_usuario, true); // LED rojo parpadea
  await esp('cierre', { botellas: 9 });
  const h = await api('GET', '/admin/turnos', { token: admin.token });
  assert.equal(h.data[0].nombre, null);
  assert.equal(h.data[0].retiradas, 1);
});

test('admin repone: no crea cuenta', async () => {
  await api('POST', '/turno', { token: admin.token });
  await esp('apertura', { botellas: 9 });
  await esp('cierre', { botellas: 20 });
  const { rows } = await pg().query(`select count(*)::int n from cuentas c join usuarios u on u.id = c.usuario_id where u.rol = 'admin'`);
  assert.equal(rows[0].n, 0);
  const h = await api('GET', '/admin/turnos', { token: admin.token });
  assert.equal(h.data[0].retiradas, -11);
});

test('admin lista impagas, marca pagada y aparece en pagadas', async () => {
  const imp = await api('GET', '/admin/cuentas?pagada=false', { token: admin.token });
  assert.equal(imp.data.length, 1); // Ana con 2 (Beto quedó en 0)
  assert.equal(imp.data[0].email, 'ana@gmail.com');

  const p = await api('PATCH', `/admin/cuentas/${imp.data[0].id}`, { token: admin.token, body: { pagada: true } });
  assert.equal(p.data.pagada, true);
  assert.equal((await api('GET', '/admin/cuentas?pagada=false', { token: admin.token })).data.length, 0);
  assert.equal((await api('GET', '/admin/cuentas?pagada=true', { token: admin.token })).data.length, 1);
});

test('admin libera un turno trabado y obtiene las lecturas para las gráficas', async () => {
  await api('POST', '/turno', { token: ana.token });
  await esp('apertura', { botellas: 20 });
  assert.equal((await api('POST', '/admin/liberar', { token: admin.token })).data.ok, true);
  assert.equal((await api('GET', '/estado', { token: beto.token })).data.refrigerador.en_uso, false);

  const g = await api('GET', '/admin/lecturas?minutos=60', { token: admin.token });
  assert.ok(g.data.length >= 1);
  assert.ok('temperatura' in g.data[0] && 'botellas' in g.data[0]);
});

test('validación de datos del ESP32', async () => {
  assert.equal((await esp('cierre', { botellas: -1 })).status, 400);
  assert.equal((await esp('apertura', {})).status, 400);
});
