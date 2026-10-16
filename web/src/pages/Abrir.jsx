// /abrir: destino del QR pegado en el refrigerador. Pide el turno apenas se entra.
import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useRefrigerador } from '../hooks/useRefrigerador.js';
import { Aviso, Cargando, MensajeError } from '../components/Comunes.jsx';
import { PanelRefrigerador } from '../components/PanelRefrigerador.jsx';

export default function Abrir() {
  const { estado, error, aviso, pidiendo, ocupado, pedirTurno, cerrarAviso } = useRefrigerador();
  const yaPedido = useRef(false);

  // Un solo POST aunque React StrictMode ejecute el efecto dos veces en desarrollo
  useEffect(() => {
    if (yaPedido.current) return;
    yaPedido.current = true;
    pedirTurno();
  }, [pedirTurno]);

  return (
    <div className="pila">
      <h1 className="titulo-pagina">Abrir refrigerador</h1>

      {aviso && <Aviso tipo={aviso.tipo} alCerrar={cerrarAviso}>{aviso.texto}</Aviso>}

      {ocupado && !estado?.mi_turno && (
        <Aviso tipo="alerta">El refrigerador está en uso, intenta en un momento.</Aviso>
      )}

      {!estado && (pidiendo || !error) && <Cargando texto="Pidiendo tu turno…" />}
      <MensajeError error={error} />

      {estado && (
        <PanelRefrigerador
          estado={estado}
          pidiendo={pidiendo}
          alAbrir={pedirTurno}
          textoBoton={ocupado || aviso ? 'Intentar de nuevo' : 'Abrir refrigerador'}
        />
      )}

      <Link to="/" className="enlace-secundario">Ver mi cuenta</Link>
    </div>
  );
}
