// Estado del refrigerador para el usuario (GET /api/estado cada 2 s) y pedido de turno.
// Lo usan la página de inicio y /abrir.
import { useCallback, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { INTERVALO_POLLING } from '../config.js';
import { usePolling } from './usePolling.js';

export function useRefrigerador() {
  const [estado, setEstado] = useState(null);     // respuesta de /api/estado + recibidoEn
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);       // { tipo: 'ok' | 'alerta' | 'error', texto }
  const [pidiendo, setPidiendo] = useState(false);
  const [ocupado, setOcupado] = useState(false);  // el último pedido respondió 409
  const turnoAnterior = useRef(null);             // para detectar cuándo termina mi turno

  const cargar = useCallback(async () => {
    try {
      const e = await api('/estado');
      const antes = turnoAnterior.current;
      const ahora = e.mi_turno?.estado ?? null;
      if (antes === 'abierto' && !ahora) {
        setAviso({ tipo: 'ok', texto: '¡Listo! Cerraste la puerta y tu consumo quedó registrado.' });
      } else if (antes === 'pendiente' && !ahora) {
        setAviso({ tipo: 'alerta', texto: 'Se acabó el tiempo y la puerta no se abrió. Puedes intentarlo de nuevo.' });
      }
      if (ahora) setOcupado(false);
      turnoAnterior.current = ahora;
      setEstado({ ...e, recibidoEn: Date.now() });
      setError(null);
    } catch (err) {
      if (err.status !== 401) setError(err);
    }
  }, []);

  usePolling(cargar, INTERVALO_POLLING);

  // POST /api/turno. Devuelve la respuesta, o null si falló.
  const pedirTurno = useCallback(async () => {
    setPidiendo(true);
    setAviso(null);
    try {
      const r = await api('/turno', { method: 'POST' });
      setOcupado(false);
      if (r.motivo === 'turno_asignado') {
        // Se muestra la cuenta regresiva al instante, sin esperar al siguiente polling
        turnoAnterior.current = 'pendiente';
        setEstado((e) => e && {
          ...e,
          refrigerador: { ...e.refrigerador, en_uso: true },
          mi_turno: { estado: 'pendiente', segundos_restantes: r.segundos },
          recibidoEn: Date.now(),
        });
      }
      cargar();
      return r;
    } catch (err) {
      if (err.status === 409) {
        setOcupado(true);
        cargar();
      } else if (err.status !== 401) {
        setAviso({ tipo: 'error', texto: err.message });
      }
      return null;
    } finally {
      setPidiendo(false);
    }
  }, [cargar]);

  return { estado, error, aviso, pidiendo, ocupado, pedirTurno, cerrarAviso: () => setAviso(null) };
}
