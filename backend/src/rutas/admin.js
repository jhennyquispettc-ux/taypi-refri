// Endpoints del administrador (dashboard y cuentas)
import { Router } from 'express';
import { autenticar, soloAdmin } from '../auth.js';
import { query } from '../db.js';
import { expirarTurnos, turnoActivo, ultimaLectura } from '../turnos.js';
import { ZONA_HORARIA } from '../config.js';

const router = Router();
router.use(autenticar, soloAdmin);

// "AAAA-MM-DD" de un día que existe (rechaza 2026-02-30)
function fechaValida(texto) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const d = new Date(`${texto}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === texto;
}

const ERROR_FECHA = { error: 'fecha debe tener el formato AAAA-MM-DD' };

// GET /api/admin/estado -> turno actual (con usuario) y última lectura
router.get('/estado', async (req, res) => {
  await expirarTurnos();
  const [turno, lectura] = await Promise.all([turnoActivo(), ultimaLectura()]);
  res.json({ turno, lectura });
});

// GET /api/admin/lecturas?minutos=60 -> serie para las gráficas (máx. ~300 puntos)
// GET /api/admin/lecturas?fecha=2026-10-15 -> ese día completo, en hora de Bolivia
router.get('/lecturas', async (req, res) => {
  const { fecha } = req.query;
  if (fecha !== undefined && !fechaValida(fecha)) return res.status(400).json(ERROR_FECHA);
  const minutos = fecha ? 24 * 60 : Math.min(Math.max(Number(req.query.minutos) || 60, 1), 7 * 24 * 60);
  const segundosPorPunto = Math.max(1, Math.ceil((minutos * 60) / 300));
  const rango = fecha
    ? `creado_en >= $1::date::timestamp at time zone '${ZONA_HORARIA}'
        and creado_en < ($1::date + 1)::timestamp at time zone '${ZONA_HORARIA}'`
    : 'creado_en > now() - make_interval(mins => $1)';
  const { rows } = await query(
    `select date_bin(make_interval(secs => $2), creado_en, timestamptz '2000-01-01') as momento,
            round(avg(botellas))::int    as botellas,
            round(avg(temperatura), 1)::float as temperatura,
            round(avg(humedad), 1)::float     as humedad,
            bool_or(puerta_abierta)       as puerta_abierta
       from lecturas
      where ${rango}
      group by 1 order by 1`,
    [fecha ?? minutos, segundosPorPunto],
  );
  res.json(rows);
});

// GET /api/admin/cuentas?pagada=false -> cuentas con bebidas, con su usuario
router.get('/cuentas', async (req, res) => {
  const pagada = req.query.pagada === 'true';
  const { rows } = await query(
    `select c.id, c.fecha::text, c.bebidas, c.pagada, c.pagada_en,
            u.id as usuario_id, u.nombre, u.email, u.foto_url
       from cuentas c join usuarios u on u.id = c.usuario_id
      where c.pagada = $1 and c.bebidas > 0
      order by c.fecha desc, u.nombre
      limit 500`,
    [pagada],
  );
  res.json(rows);
});

// PATCH /api/admin/cuentas/:id { pagada } -> marcar pagada / no pagada
router.patch('/cuentas/:id', async (req, res) => {
  const { pagada } = req.body ?? {};
  if (typeof pagada !== 'boolean') return res.status(400).json({ error: 'pagada debe ser true o false' });
  const { rows } = await query(
    `update cuentas set pagada = $2, pagada_en = case when $2 then now() end
      where id = $1 returning id, fecha::text, bebidas, pagada, pagada_en`,
    [Number(req.params.id), pagada],
  );
  if (!rows[0]) return res.status(404).json({ error: 'Cuenta no encontrada' });
  res.json(rows[0]);
});

// GET /api/admin/turnos?limite=50 -> historial de usos del refrigerador
// GET /api/admin/turnos?fecha=2026-10-15 -> solo los usos de ese día (hora de Bolivia)
router.get('/turnos', async (req, res) => {
  const { fecha } = req.query;
  if (fecha !== undefined && !fechaValida(fecha)) return res.status(400).json(ERROR_FECHA);
  const limite = Math.min(Number(req.query.limite) || 50, 500);
  const { rows } = await query(
    `select t.id, t.estado, t.abierto_en, t.cerrado_en, t.botellas_inicio, t.botellas_fin,
            t.retiradas, t.corte_automatico, u.nombre, u.email, u.rol
       from turnos t left join usuarios u on u.id = t.usuario_id
      where t.estado in ('abierto', 'cerrado', 'liberado')
        and ($2::date is null
             or (coalesce(t.abierto_en, t.creado_en) at time zone '${ZONA_HORARIA}')::date = $2::date)
      order by t.id desc limit $1`,
    [limite, fecha ?? null],
  );
  res.json(rows);
});

// POST /api/admin/liberar -> cancela el turno activo si el refrigerador quedó trabado
router.post('/liberar', async (req, res) => {
  const { rows } = await query(
    `update turnos set estado = 'liberado', cerrado_en = now()
      where estado in ('pendiente', 'abierto') returning id`,
  );
  res.json({ ok: rows.length > 0 });
});

export default router;
