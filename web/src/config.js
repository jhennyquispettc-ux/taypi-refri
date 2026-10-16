// Variables de entorno (Vite solo expone las que empiezan con VITE_)
export const API_URL = (import.meta.env.VITE_API_URL ?? '').trim().replace(/\/+$/, '');
export const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim();

// Lista de variables que faltan (para la pantalla "Falta configuración")
export const configFaltante = [
  !API_URL && 'VITE_API_URL',
  !GOOGLE_CLIENT_ID && 'VITE_GOOGLE_CLIENT_ID',
].filter(Boolean);

// Cada cuánto se consulta el backend (tiempo real por polling)
export const INTERVALO_POLLING = 2000;
