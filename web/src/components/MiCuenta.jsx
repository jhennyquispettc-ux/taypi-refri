// Tarjeta "Mi cuenta de hoy" e historial plegable de cuentas
import { useState } from 'react';
import { api } from '../lib/api.js';
import { fechaCorta, fechaLarga, plural } from '../lib/formato.js';
import { Cargando, Insignia, MensajeError } from './Comunes.jsx';

export function CuentaHoy({ cuenta, esAdmin }) {
  return (
    <section className="tarjeta">
      <div className="tarjeta-titulo">
        <h2>Mi cuenta de hoy</h2>
        {cuenta && cuenta.bebidas > 0 && (
          cuenta.pagada
            ? <Insignia tipo="ok">Pagada</Insignia>
            : <Insignia tipo="alerta">Pendiente de pago</Insignia>
        )}
      </div>
      <div className="dato">
        <span className="dato-valor">{cuenta?.bebidas ?? 0}</span>
        <span className="dato-etiqueta">{(cuenta?.bebidas ?? 0) === 1 ? 'bebida' : 'bebidas'}</span>
      </div>
      <p className="nota">
        {esAdmin
          ? 'Como administrador, lo que pongas o saques cuenta como reposición y no genera cuenta.'
          : `Hoy es ${fechaLarga(cuenta?.fecha ?? hoyTexto())}.`}
      </p>
    </section>
  );
}

// Fecha de hoy en Bolivia como "YYYY-MM-DD"
function hoyTexto() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/La_Paz' });
}

// Se carga solo la primera vez que se abre
export function Historial() {
  const [cuentas, setCuentas] = useState(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);

  async function cargar() {
    setCargando(true);
    try {
      setCuentas(await api('/cuentas'));
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setCargando(false);
    }
  }

  function alAbrirCerrar(evento) {
    if (evento.currentTarget.open && !cuentas && !cargando) cargar();
  }

  const conConsumo = cuentas?.filter((c) => c.bebidas > 0) ?? [];

  return (
    <details className="tarjeta plegable" onToggle={alAbrirCerrar}>
      <summary><h2>Historial</h2></summary>
      {cargando && <Cargando />}
      <MensajeError error={error} alReintentar={cargar} />
      {cuentas && conConsumo.length === 0 && <p className="nota">Todavía no tienes consumos registrados.</p>}
      {conConsumo.length > 0 && (
        <ul className="lista-historial">
          {conConsumo.map((c) => (
            <li key={c.id}>
              <span className="historial-fecha">{fechaCorta(c.fecha)}</span>
              <span>{plural(c.bebidas, 'bebida')}</span>
              {c.pagada
                ? <Insignia tipo="ok">Pagada</Insignia>
                : <Insignia tipo="alerta">Pendiente</Insignia>}
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
