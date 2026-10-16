// GET periódico a una ruta del backend: { datos, error, cargando, recargar }
import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { usePolling } from './usePolling.js';

export function useConsulta(ruta, intervalo) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [rutaCargada, setRutaCargada] = useState(null);
  const [actualizadoEn, setActualizadoEn] = useState(null);

  // Si cambia la ruta (otro rango, otra pestaña) se descartan los datos viejos
  useEffect(() => {
    setDatos(null);
    setError(null);
  }, [ruta]);

  const recargar = useCallback(async () => {
    try {
      const r = await api(ruta);
      setDatos(r);
      setActualizadoEn(Date.now());
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setRutaCargada(ruta);
    }
  }, [ruta]);

  usePolling(recargar, intervalo, { clave: ruta });

  return { datos, error, cargando: rutaCargada !== ruta, actualizadoEn, recargar };
}
