// Lógica del refrigerador: turnos (bloqueo), cuentas del día y eventos del ESP32.
import { query, transaccion } from './db.js';
import { SEGUNDOS_PARA_ABRIR, GRACIA_SEGUNDOS, ZONA_HORARIA } from './config.js';

const HOY = `(now() at time zone '${ZONA_HORARIA}')::date`;

// Los turnos pendientes que no abrieron a tiempo se liberan.
// Se llama al inicio de cada operación (el ESP32 consulta cada 1 s).
export async function expirarTurnos(db = { query }) {
  await db.query(
    `update turnos set estado = 'expirado', cerrado_en = now()
      where estado = 'pendiente' and expira_en < now() - make_interval(secs => $1)`,
    [GRACIA_SEGUNDOS],
  );
}

export async function turnoActivo(db = { query }) {
  const { rows } = await db.query(
    `select t.*, u.nombre as usuario_nombre, u.rol as usuario_rol,
            greatest(0, ceil(extract(epoch from t.expira_en - now())))::int as segundos_restantes
       from turnos t left join usuarios u on u.id = t.usuario_id
      where t.estado in ('pendiente', 'abierto')`,
  );
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Web: el usuario pide abrir el refrigerador (botón o QR del refrigerador)
// ---------------------------------------------------------------------------
export function pedirTurno(usuario) {
  return transaccion(async (db) => {
    await expirarTurnos(db);
    const activo = await turnoActivo(db);
    if (activo) {
      const mio = activo.usuario_id === usuario.id;
      return { ok: mio, motivo: mio ? 'ya_es_tu_turno' : 'ocupado' };
    }

    // Cuenta del día: se busca y, si no existe, se crea (solo clientes)
    let cuentaId = null;
    if (usuario.rol === 'cliente') {
      const { rows } = await db.query(
        `insert into cuentas (usuario_id, fecha) values ($1, ${HOY})
         on conflict (usuario_id, fecha) do update set usuario_id = excluded.usuario_id
         returning id`,
        [usuario.id],
      );
      cuentaId = rows[0].id;
    }

    try {
      await db.query(
        `insert into turnos (usuario_id, cuenta_id, expira_en)
         values ($1, $2, now() + make_interval(secs => $3))`,
        [usuario.id, cuentaId, SEGUNDOS_PARA_ABRIR],
      );
    } catch (e) {
      // Otro usuario ganó el turno en el mismo instante (índice turnos_un_activo)
      if (e.code === '23505') return { ok: false, motivo: 'ocupado' };
      throw e;
    }
    return { ok: true, motivo: 'turno_asignado', segundos: SEGUNDOS_PARA_ABRIR };
  });
}

// ---------------------------------------------------------------------------
// ESP32
// ---------------------------------------------------------------------------

// Lectura cada 1 s: se guarda y se responde si hay turno (para el LED)
export async function registrarLectura({ botellas, temperatura, humedad, puerta_abierta }) {
  await query(
    `insert into lecturas (botellas, temperatura, humedad, puerta_abierta) values ($1, $2, $3, $4)`,
    [botellas, temperatura, humedad, puerta_abierta],
  );
  await expirarTurnos();
  const t = await turnoActivo();
  return {
    turno: Boolean(t?.usuario_id),          // LED verde
    estado: t?.estado ?? 'libre',
    sin_usuario: Boolean(t && !t.usuario_id), // puerta abierta sin turno: LED rojo parpadea
  };
}

// La puerta se abrió: se guarda cuántas botellas había
export function registrarApertura(botellas) {
  return transaccion(async (db) => {
    await expirarTurnos(db);
    const t = await turnoActivo(db);

    if (t?.estado === 'abierto') {
      return { ok: true, repetido: true, identificado: Boolean(t.usuario_id) }; // reintento del ESP32
    }
    if (t?.estado === 'pendiente') {
      await db.query(
        `update turnos set estado = 'abierto', abierto_en = now(),
                botellas_inicio = $2, botellas_corte = $2
          where id = $1`,
        [t.id, botellas],
      );
      return { ok: true, identificado: true };
    }
    // Nadie pidió turno: se registra un uso sin usuario
    await db.query(
      `insert into turnos (usuario_id, estado, abierto_en, botellas_inicio, botellas_corte)
       values (null, 'abierto', now(), $1, $1)`,
      [botellas],
    );
    return { ok: true, identificado: false };
  });
}

// Aplica la diferencia desde el último corte a la cuenta del día
async function aplicarCambio(db, t, botellas) {
  const sacadas = t.botellas_corte - botellas; // + sacó, − devolvió o repuso
  if (t.cuenta_id && sacadas !== 0) {
    await db.query(
      `update cuentas set bebidas = greatest(0, bebidas + $2) where id = $1`,
      [t.cuenta_id, sacadas],
    );
  }
  return sacadas;
}

// Pasaron 2 min con la puerta abierta: se cobra lo sacado hasta ahora,
// pero el turno sigue bloqueado para el mismo usuario hasta el cierre real.
export function registrarCorte(botellas) {
  return transaccion(async (db) => {
    const t = await turnoActivo(db);
    if (t?.estado !== 'abierto') return { ok: true, ignorado: true };
    const sacadas = await aplicarCambio(db, t, botellas);
    await db.query(
      `update turnos set botellas_corte = $2, retiradas = retiradas + $3, corte_automatico = true
        where id = $1`,
      [t.id, botellas, sacadas],
    );
    return { ok: true, sacadas };
  });
}

// La puerta se cerró: se cobra lo que falte y se libera el refrigerador
export function registrarCierre(botellas) {
  return transaccion(async (db) => {
    const t = await turnoActivo(db);
    if (t?.estado !== 'abierto') return { ok: true, ignorado: true }; // reintento repetido
    const sacadas = await aplicarCambio(db, t, botellas);
    await db.query(
      `update turnos set estado = 'cerrado', cerrado_en = now(), botellas_fin = $2,
              botellas_corte = $2, retiradas = retiradas + $3
        where id = $1`,
      [t.id, botellas, sacadas],
    );
    return {
      ok: true,
      sacadas: t.retiradas + sacadas,
      identificado: Boolean(t.usuario_id),
    };
  });
}

// ---------------------------------------------------------------------------
// Consultas para la web
// ---------------------------------------------------------------------------
export async function ultimaLectura() {
  const { rows } = await query(
    `select botellas, temperatura::float, humedad::float, puerta_abierta, creado_en,
            creado_en > now() - interval '5 seconds' as en_linea
       from lecturas order by creado_en desc limit 1`,
  );
  return rows[0] ?? null;
}

export async function cuentaDeHoy(usuarioId) {
  const { rows } = await query(
    `select id, fecha::text, bebidas, pagada from cuentas where usuario_id = $1 and fecha = ${HOY}`,
    [usuarioId],
  );
  return rows[0] ?? null;
}
