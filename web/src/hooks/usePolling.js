// Ejecuta fn cada `ms` milisegundos mientras la pestaña esté visible.
// - Espera a que termine una consulta antes de programar la siguiente (no se encimen).
// - Al volver a la pestaña consulta de inmediato.
// - Si cambia `clave` (por ejemplo el rango de la gráfica) reinicia el ciclo.
// - Si `activo` es false no hace nada.
import { useEffect, useRef } from 'react';

export function usePolling(fn, ms, { clave, activo = true } = {}) {
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });

  useEffect(() => {
    if (!activo) return undefined;
    let vivo = true;
    let corriendo = false;
    let timer = null;

    const tick = async () => {
      clearTimeout(timer);
      if (!vivo || document.hidden || corriendo) return;
      corriendo = true;
      try {
        await fnRef.current();
      } catch {
        // cada componente maneja sus errores dentro de fn
      } finally {
        corriendo = false;
      }
      if (vivo && !document.hidden) timer = setTimeout(tick, ms);
    };

    const alCambiarVisibilidad = () => {
      if (document.hidden) clearTimeout(timer);
      else tick();
    };

    document.addEventListener('visibilitychange', alCambiarVisibilidad);
    tick();
    return () => {
      vivo = false;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);
    };
  }, [ms, clave, activo]);
}
