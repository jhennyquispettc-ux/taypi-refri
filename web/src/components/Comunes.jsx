// Componentes pequeños reutilizables
import { useState } from 'react';

export function Cargando({ texto = 'Cargando…' }) {
  return (
    <div className="cargando" role="status">
      <span className="spinner" aria-hidden="true" />
      {texto}
    </div>
  );
}

export function MensajeError({ error, alReintentar }) {
  if (!error) return null;
  return (
    <div className="aviso aviso-error" role="alert">
      <span>{error.message ?? String(error)}</span>
      {alReintentar && (
        <button type="button" className="btn btn-chico" onClick={alReintentar}>Reintentar</button>
      )}
    </div>
  );
}

export function Aviso({ tipo = 'info', children, alCerrar }) {
  return (
    <div className={`aviso aviso-${tipo}`} role={tipo === 'error' ? 'alert' : 'status'}>
      <span>{children}</span>
      {alCerrar && (
        <button type="button" className="aviso-cerrar" onClick={alCerrar} aria-label="Cerrar aviso">×</button>
      )}
    </div>
  );
}

// Foto de Google con iniciales de respaldo
export function Avatar({ foto, nombre, tamano = 40 }) {
  const [fallo, setFallo] = useState(false);
  const iniciales = (nombre ?? '?')
    .split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
  const estilo = { width: tamano, height: tamano, fontSize: tamano * 0.4 };

  if (foto && !fallo) {
    return (
      <img
        className="avatar" src={foto} alt="" style={estilo}
        referrerPolicy="no-referrer" onError={() => setFallo(true)}
      />
    );
  }
  return <span className="avatar avatar-iniciales" style={estilo} aria-hidden="true">{iniciales}</span>;
}

export function Insignia({ tipo = 'neutra', children }) {
  return <span className={`insignia insignia-${tipo}`}>{children}</span>;
}
