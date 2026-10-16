// Dashboard del administrador: indicadores en vivo, gráficas y últimos usos
import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useConsulta } from '../../hooks/useConsulta.js';
import { useCuentaRegresiva } from '../../hooks/useCuentaRegresiva.js';
import { api } from '../../lib/api.js';
import { INTERVALO_POLLING } from '../../config.js';
import { fechaHora, hora, humedad, temperatura } from '../../lib/formato.js';
import { Aviso, Cargando, Insignia, MensajeError } from '../../components/Comunes.jsx';
import { GraficaBotellas, GraficaClima } from './Graficas.jsx';

const RANGOS = [
  { minutos: 15, texto: '15 min' },
  { minutos: 60, texto: '1 h' },
  { minutos: 360, texto: '6 h' },
  { minutos: 1440, texto: '24 h' },
];

export default function Dashboard() {
  const [minutos, setMinutos] = useState(60);
  const estado = useConsulta('/admin/estado', INTERVALO_POLLING);
  const lecturas = useConsulta(`/admin/lecturas?minutos=${minutos}`, INTERVALO_POLLING);
  const turnos = useConsulta('/admin/turnos?limite=30', 5000);

  // 403: el usuario dejó de ser admin
  if ([estado, lecturas, turnos].some((c) => c.error?.status === 403)) return <Navigate to="/" replace />;

  return (
    <div className="pila">
      <div className="titulo-con-accion">
        <h1 className="titulo-pagina">Dashboard</h1>
        <Link to="/admin/cuentas" className="btn btn-chico">Ver cuentas</Link>
      </div>

      <Indicadores consulta={estado} alLiberar={() => { estado.recargar(); turnos.recargar(); }} />

      <section className="tarjeta">
        <div className="tarjeta-titulo">
          <h2>Gráficas</h2>
          <div className="segmentado" role="group" aria-label="Rango de tiempo">
            {RANGOS.map((r) => (
              <button
                key={r.minutos}
                type="button"
                className={r.minutos === minutos ? 'activo' : ''}
                aria-pressed={r.minutos === minutos}
                onClick={() => setMinutos(r.minutos)}
              >
                {r.texto}
              </button>
            ))}
          </div>
        </div>
        <MensajeError error={lecturas.error} />
        {lecturas.cargando && !lecturas.datos && <Cargando />}
        {lecturas.datos && lecturas.datos.length === 0 && (
          <p className="nota">No hay lecturas en este rango. ¿Está encendido el ESP32?</p>
        )}
        {lecturas.datos && lecturas.datos.length > 0 && (
          <>
            <h3 className="subtitulo">Botellas en el tiempo</h3>
            <GraficaBotellas lecturas={lecturas.datos} minutos={minutos} />
            <h3 className="subtitulo">Temperatura y humedad</h3>
            <GraficaClima lecturas={lecturas.datos} minutos={minutos} />
            <p className="nota"><span className="muestra-puerta" /> Zona sombreada: puerta abierta.</p>
          </>
        )}
      </section>

      <UltimosUsos consulta={turnos} />
    </div>
  );
}

function Indicadores({ consulta, alLiberar }) {
  const { datos, error, actualizadoEn } = consulta;
  const [liberando, setLiberando] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  const turno = datos?.turno ?? null;
  const segundos = useCuentaRegresiva(
    turno?.estado === 'pendiente' ? turno.segundos_restantes : null,
    actualizadoEn,
  );

  if (!datos) return error ? <MensajeError error={error} /> : <Cargando />;
  const l = datos.lectura;

  async function liberar() {
    const quien = turno.usuario_nombre ?? 'sin usuario';
    if (!window.confirm(`¿Liberar el refrigerador? Se cancelará el turno actual (${quien}).`)) return;
    setLiberando(true);
    try {
      const r = await api('/admin/liberar', { method: 'POST' });
      setMensaje(r.ok
        ? { tipo: 'ok', texto: 'Refrigerador liberado.' }
        : { tipo: 'info', texto: 'No había ningún turno activo.' });
      alLiberar();
    } catch (e) {
      setMensaje({ tipo: 'error', texto: e.message });
    } finally {
      setLiberando(false);
    }
  }

  return (
    <section className="pila">
      {error && <MensajeError error={error} />}
      <div className="kpis">
        <Kpi etiqueta="Botellas" valor={l?.botellas ?? '—'} />
        <Kpi etiqueta="Temperatura" valor={temperatura(l?.temperatura)} />
        <Kpi etiqueta="Humedad" valor={humedad(l?.humedad)} />
        <Kpi
          etiqueta="Puerta"
          valor={l ? (l.puerta_abierta ? 'Abierta' : 'Cerrada') : '—'}
          tipo={l?.puerta_abierta ? 'alerta' : undefined}
        />
        <Kpi
          etiqueta="ESP32"
          valor={l?.en_linea ? 'En línea' : 'Sin conexión'}
          tipo={l?.en_linea ? 'ok' : 'error'}
          detalle={l?.creado_en ? `Última lectura ${hora(l.creado_en, true)}` : 'Sin lecturas'}
        />
        <Kpi etiqueta="Turno actual" {...textoTurno(turno, segundos)} ancho />
      </div>

      {mensaje && <Aviso tipo={mensaje.tipo} alCerrar={() => setMensaje(null)}>{mensaje.texto}</Aviso>}

      <button
        type="button"
        className="btn btn-peligro"
        disabled={!turno || liberando}
        onClick={liberar}
        title={turno ? 'Cancela el turno activo' : 'No hay un turno activo'}
      >
        {liberando ? 'Liberando…' : 'Liberar refrigerador'}
      </button>
    </section>
  );
}

function textoTurno(turno, segundos) {
  if (!turno) return { valor: 'Libre', tipo: 'ok' };
  if (!turno.usuario_nombre) return { valor: 'Sin usuario — puerta abierta', tipo: 'alerta' };
  const rol = turno.usuario_rol === 'admin' ? ' (admin)' : '';
  if (turno.estado === 'pendiente') return { valor: `${turno.usuario_nombre}${rol} — pendiente ${segundos ?? 0} s` };
  return { valor: `${turno.usuario_nombre}${rol} — puerta abierta` };
}

function Kpi({ etiqueta, valor, detalle, tipo, ancho }) {
  return (
    <div className={`kpi ${tipo ? `kpi-${tipo}` : ''} ${ancho ? 'kpi-ancho' : ''}`}>
      <span className="kpi-etiqueta">{etiqueta}</span>
      <span className="kpi-valor">{valor}</span>
      {detalle && <span className="kpi-detalle">{detalle}</span>}
    </div>
  );
}

function UltimosUsos({ consulta }) {
  const { datos, error } = consulta;
  return (
    <section className="tarjeta">
      <div className="tarjeta-titulo"><h2>Últimos usos</h2></div>
      <MensajeError error={error} />
      {!datos && !error && <Cargando />}
      {datos && datos.length === 0 && <p className="nota">Todavía no hay usos registrados.</p>}
      {datos && datos.length > 0 && (
        <div className="tabla-scroll">
          <table className="tabla">
            <thead>
              <tr>
                <th>Hora</th>
                <th>Usuario</th>
                <th>Botellas</th>
                <th>Retiradas</th>
                <th>Notas</th>
              </tr>
            </thead>
            <tbody>
              {datos.map((t) => (
                <tr key={t.id}>
                  <td className="sin-salto">{fechaHora(t.abierto_en)}</td>
                  <td>
                    {t.nombre
                      ? <>{t.nombre}{t.rol === 'admin' && <> <Insignia>admin</Insignia></>}</>
                      : <Insignia tipo="alerta">Sin usuario</Insignia>}
                  </td>
                  <td className="sin-salto">{t.botellas_inicio ?? '—'} → {t.botellas_fin ?? '…'}</td>
                  <td className="sin-salto"><Retiradas n={t.retiradas} /></td>
                  <td>
                    {t.estado === 'abierto' && <Insignia tipo="ok">En curso</Insignia>}
                    {t.estado === 'liberado' && <Insignia>Liberado</Insignia>}
                    {t.corte_automatico && <Insignia tipo="alerta">Corte automático</Insignia>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Retiradas({ n }) {
  if (n > 0) return <span className="positivo">+{n} sacó</span>;
  if (n < 0) return <span className="negativo">−{Math.abs(n)} devolvió/repuso</span>;
  return <span className="nota">0</span>;
}
