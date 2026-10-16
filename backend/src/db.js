// Acceso a PostgreSQL (Supabase). En las pruebas se reemplaza por PGlite.
import pg from 'pg';

let pool = null;
let adaptador = null;

export function conectar(databaseUrl) {
  pool = new pg.Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false },
    max: 5,
  });
}

// Solo para pruebas: un objeto con query() y transaction()
export function usarAdaptador(a) {
  adaptador = a;
}

export function query(sql, params) {
  return (adaptador ?? pool).query(sql, params);
}

// Ejecuta fn(db) dentro de una transacción: todo o nada
export async function transaccion(fn) {
  if (adaptador) return adaptador.transaction((tx) => fn(tx));
  const cliente = await pool.connect();
  try {
    await cliente.query('begin');
    const resultado = await fn(cliente);
    await cliente.query('commit');
    return resultado;
  } catch (e) {
    await cliente.query('rollback');
    throw e;
  } finally {
    cliente.release();
  }
}
