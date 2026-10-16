// Tarjeta "Refrigerador": estado, botellas, temperatura y el botón / cuenta regresiva.
// La comparten la página de inicio y /abrir.
import { useCuentaRegresiva } from '../hooks/useCuentaRegresiva.js';
import { temperatura } from '../lib/formato.js';
import { Insignia } from './Comunes.jsx';

function estadoTexto(refri, miTurno) {
  if (miTurno) return { texto: 'Tu turno', tipo: 'ok' };
  if (!refri.en_linea) return { texto: 'Sin conexión', tipo: 'neutra' };
  if (refri.en_uso) return { texto: 'En uso', tipo: 'alerta' };
  return { texto: 'Libre', tipo: 'ok' };
}

export function PanelRefrigerador({ estado, pidiendo, alAbrir, textoBoton = 'Abrir refrigerador' }) {
  const { refrigerador: refri, mi_turno: miTurno, recibidoEn } = estado;
  const segundos = useCuentaRegresiva(
    miTurno?.estado === 'pendiente' ? miTurno.segundos_restantes : null,
    recibidoEn,
  );
  const insignia = estadoTexto(refri, miTurno);
  const puedeAbrir = !refri.en_uso && refri.en_linea;

  return (
    <section className="tarjeta">
      <div className="tarjeta-titulo">
        <h2>Refrigerador</h2>
        <Insignia tipo={insignia.tipo}>{insignia.texto}</Insignia>
      </div>

      <div className="datos">
        <div className="dato">
          <span className="dato-valor">{refri.botellas ?? '—'}</span>
          <span className="dato-etiqueta">botellas disponibles</span>
        </div>
        <div className="dato">
          <span className="dato-valor">{temperatura(refri.temperatura)}</span>
          <span className="dato-etiqueta">temperatura</span>
        </div>
      </div>

      {miTurno?.estado === 'pendiente' && (
        <div className="turno turno-pendiente" aria-live="assertive">
          <p className="turno-titulo">¡Abre la puerta ahora!</p>
          <p className="turno-segundos">{segundos} s</p>
          <p className="turno-ayuda">Si no la abres a tiempo, el turno se libera.</p>
        </div>
      )}

      {miTurno?.estado === 'abierto' && (
        <div className="turno turno-abierto" aria-live="polite">
          <p className="turno-titulo">Puerta abierta</p>
          <p>Saca tus bebidas y cierra la puerta. Tienes 2 minutos.</p>
        </div>
      )}

      {!miTurno && (
        <>
          <button
            type="button"
            className="btn btn-primario btn-grande"
            disabled={!puedeAbrir || pidiendo}
            onClick={alAbrir}
          >
            {pidiendo ? 'Pidiendo turno…' : textoBoton}
          </button>
          {!refri.en_linea && (
            <p className="nota">El refrigerador no está conectado en este momento.</p>
          )}
          {refri.en_linea && refri.en_uso && (
            <p className="nota">Otra persona lo está usando. Espera un momento.</p>
          )}
        </>
      )}
    </section>
  );
}
