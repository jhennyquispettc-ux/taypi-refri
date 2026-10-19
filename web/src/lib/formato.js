// Funciones de formato en español de Bolivia
const LOCALE = 'es-BO';

// "2026-10-15" -> "mié., 15 oct." (sin pasar por UTC para no cambiar el día)
export function fechaCorta(fechaTexto) {
  if (!fechaTexto) return '—';
  const [a, m, d] = fechaTexto.slice(0, 10).split('-').map(Number);
  return new Date(a, m - 1, d).toLocaleDateString(LOCALE, { weekday: 'short', day: 'numeric', month: 'short' });
}

export function fechaLarga(fechaTexto) {
  if (!fechaTexto) return '—';
  const [a, m, d] = fechaTexto.slice(0, 10).split('-').map(Number);
  return new Date(a, m - 1, d).toLocaleDateString(LOCALE, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

// Fecha de hoy en Bolivia como "2026-10-15" (para el selector de fecha)
export function hoyBolivia() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/La_Paz' });
}

// "2026-10-15" -> milisegundos de las 00:00 de ese día en Bolivia (UTC−4 todo el año, sin horario de verano)
export function inicioDiaBolivia(fechaTexto) {
  return Date.parse(`${fechaTexto}T00:00:00-04:00`);
}

export function hora(momento, conSegundos = false) {
  if (!momento) return '—';
  return new Date(momento).toLocaleTimeString(LOCALE, {
    hour: '2-digit', minute: '2-digit', ...(conSegundos && { second: '2-digit' }),
  });
}

export function fechaHora(momento) {
  if (!momento) return '—';
  return new Date(momento).toLocaleString(LOCALE, {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export function temperatura(valor) {
  return valor == null ? '—' : `${Number(valor).toFixed(1)} °C`;
}

export function humedad(valor) {
  return valor == null ? '—' : `${Math.round(valor)} %`;
}

export function plural(n, singular, pluralTexto = `${singular}s`) {
  return `${n} ${n === 1 ? singular : pluralTexto}`;
}

export function primerNombre(nombre) {
  return (nombre ?? '').trim().split(/\s+/)[0] || 'usuario';
}
