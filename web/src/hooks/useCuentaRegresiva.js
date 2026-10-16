// Segundos restantes "en vivo": parte del valor del servidor y descuenta localmente
// entre una consulta y otra.
import { useEffect, useState } from 'react';

export function useCuentaRegresiva(segundos, recibidoEn) {
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    if (segundos == null) return undefined;
    const id = setInterval(() => setAhora(Date.now()), 250);
    return () => clearInterval(id);
  }, [segundos, recibidoEn]);

  if (segundos == null) return null;
  const transcurrido = Math.max(0, (ahora - recibidoEn) / 1000);
  return Math.max(0, Math.ceil(segundos - transcurrido));
}
