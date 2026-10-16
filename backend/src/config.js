// Configuración leída de variables de entorno (.env en local, panel de Render en producción)
function requerida(nombre) {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta la variable de entorno ${nombre}`);
  return valor;
}

export function cargarConfig() {
  return {
    puerto: Number(process.env.PORT ?? 3000),
    databaseUrl: requerida('DATABASE_URL'),
    jwtSecret: requerida('JWT_SECRET'),
    googleClientId: requerida('GOOGLE_CLIENT_ID'),
    deviceKey: requerida('DEVICE_KEY'),
    // Orígenes permitidos para CORS (la URL de la web en Vercel), separados por coma
    webOrigins: (process.env.WEB_ORIGIN ?? 'http://localhost:5173').split(',').map((s) => s.trim()),
  };
}

// Reglas del negocio
export const SEGUNDOS_PARA_ABRIR = 30;  // desde que se asigna el turno
export const GRACIA_SEGUNDOS = 2;       // margen por la latencia de red del ESP32
export const ZONA_HORARIA = 'America/La_Paz';
