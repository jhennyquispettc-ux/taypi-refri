// Endpoints de la web para cualquier usuario con sesión (cliente o admin)
import { Router } from 'express';
import { autenticar, loginGoogle } from '../auth.js';
import { query } from '../db.js';
import { pedirTurno, expirarTurnos, turnoActivo, ultimaLectura, cuentaDeHoy } from '../turnos.js';

const router = Router();

// POST /api/auth/google { credential } -> { token, usuario }
router.post('/auth/google', async (req, res) => {
  const { credential } = req.body ?? {};
  if (!credential) return res.status(400).json({ error: 'Falta credential' });
  try {
    res.json(await loginGoogle(credential));
  } catch (e) {
    res.status(e.status ?? 401).json({ error: e.status ? e.message : 'Token de Google inválido' });
  }
});

router.use(autenticar);

// GET /api/yo -> usuario actual
router.get('/yo', (req, res) => res.json(req.usuario));

// GET /api/estado -> estado del refrigerador, mi turno y mi cuenta de hoy (polling cada 2 s)
router.get('/estado', async (req, res) => {
  await expirarTurnos();
  const [activo, lectura, cuenta] = await Promise.all([
    turnoActivo(), ultimaLectura(), cuentaDeHoy(req.usuario.id),
  ]);
  const mio = activo && activo.usuario_id === req.usuario.id;
  res.json({
    refrigerador: {
      en_uso: Boolean(activo),
      en_linea: Boolean(lectura?.en_linea),
      puerta_abierta: lectura?.puerta_abierta ?? false,
      botellas: lectura?.botellas ?? null,
      temperatura: lectura?.temperatura ?? null,
    },
    mi_turno: mio
      ? { estado: activo.estado, segundos_restantes: activo.estado === 'pendiente' ? activo.segundos_restantes : null }
      : null,
    cuenta_hoy: cuenta,
  });
});

// POST /api/turno -> pedir abrir el refrigerador
router.post('/turno', async (req, res) => {
  const r = await pedirTurno(req.usuario);
  res.status(r.ok ? 200 : 409).json(r);
});

// GET /api/cuentas -> mis cuentas (historial)
router.get('/cuentas', async (req, res) => {
  const { rows } = await query(
    `select id, fecha::text, bebidas, pagada from cuentas
      where usuario_id = $1 order by fecha desc limit 30`,
    [req.usuario.id],
  );
  res.json(rows);
});

export default router;
