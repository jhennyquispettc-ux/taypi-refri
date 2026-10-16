// Cuentas de los usuarios: pestañas Impagas / Pagadas, búsqueda y marcar pagada
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { fechaLarga, plural } from '../../lib/formato.js';
import { Aviso, Avatar, Cargando, MensajeError } from '../../components/Comunes.jsx';

export default function Cuentas() {
  // Se cargan las dos listas para tener los totales y mover cuentas entre pestañas al instante
  const [listas, setListas] = useState({ impagas: null, pagadas: null });
  const [error, setError] = useState(null);
  const [pestana, setPestana] = useState('impagas');
  const [busqueda, setBusqueda] = useState('');
  const [recientesPrimero, setRecientesPrimero] = useState(true);
  const [guardando, setGuardando] = useState(() => new Set()); // ids con PATCH en curso
  const [aviso, setAviso] = useState(null);

  const cargar = useCallback(async () => {
    try {
      const [impagas, pagadas] = await Promise.all([
        api('/admin/cuentas?pagada=false'),
        api('/admin/cuentas?pagada=true'),
      ]);
      setListas({ impagas, pagadas });
      setError(null);
    } catch (e) {
      setError(e);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Actualización optimista: se mueve la cuenta de lista y, si falla, se revierte
  async function cambiarPagada(cuenta, pagada) {
    const origen = pagada ? 'impagas' : 'pagadas';
    const destino = pagada ? 'pagadas' : 'impagas';
    const movida = { ...cuenta, pagada, pagada_en: pagada ? new Date().toISOString() : null };
    // Mueve una cuenta de una lista a otra (se usa también para revertir)
    const mover = (de, a, item) => setListas((l) => ({
      [de]: l[de].filter((c) => c.id !== item.id),
      [a]: [item, ...l[a]],
    }));
    mover(origen, destino, movida);
    setGuardando((s) => new Set(s).add(cuenta.id));
    setAviso(null);
    try {
      const r = await api(`/admin/cuentas/${cuenta.id}`, { method: 'PATCH', body: { pagada } });
      setListas((l) => ({
        ...l,
        [destino]: l[destino].map((c) => (c.id === r.id ? { ...c, ...r } : c)),
      }));
    } catch (e) {
      mover(destino, origen, cuenta);
      setAviso(`No se pudo actualizar la cuenta de ${cuenta.nombre}: ${e.message}`);
    } finally {
      setGuardando((s) => {
        const copia = new Set(s);
        copia.delete(cuenta.id);
        return copia;
      });
    }
  }

  const visibles = useMemo(() => {
    const lista = listas[pestana] ?? [];
    const texto = busqueda.trim().toLowerCase();
    const filtradas = texto
      ? lista.filter((c) => `${c.nombre} ${c.email}`.toLowerCase().includes(texto))
      : lista;
    return [...filtradas].sort((a, b) => {
      const orden = recientesPrimero ? b.fecha.localeCompare(a.fecha) : a.fecha.localeCompare(b.fecha);
      return orden || (a.nombre ?? '').localeCompare(b.nombre ?? '');
    });
  }, [listas, pestana, busqueda, recientesPrimero]);

  // Agrupadas por fecha: [[fecha, [cuentas]], ...]
  const grupos = useMemo(() => {
    const mapa = new Map();
    for (const c of visibles) {
      if (!mapa.has(c.fecha)) mapa.set(c.fecha, []);
      mapa.get(c.fecha).push(c);
    }
    return [...mapa];
  }, [visibles]);

  if (error?.status === 403) return <Navigate to="/" replace />;

  const impagas = listas.impagas ?? [];
  const bebidasImpagas = impagas.reduce((s, c) => s + c.bebidas, 0);
  const cargado = listas.impagas && listas.pagadas;

  return (
    <div className="pila">
      <div className="titulo-con-accion">
        <h1 className="titulo-pagina">Cuentas</h1>
        <button type="button" className="btn btn-chico" onClick={cargar}>Actualizar</button>
      </div>

      <div className="kpis">
        <div className="kpi kpi-alerta">
          <span className="kpi-etiqueta">Cuentas impagas</span>
          <span className="kpi-valor">{cargado ? impagas.length : '—'}</span>
        </div>
        <div className="kpi kpi-alerta">
          <span className="kpi-etiqueta">Bebidas impagas</span>
          <span className="kpi-valor">{cargado ? bebidasImpagas : '—'}</span>
        </div>
      </div>

      <div className="pestanas" role="tablist">
        {[
          ['impagas', 'Impagas'],
          ['pagadas', 'Pagadas'],
        ].map(([clave, texto]) => (
          <button
            key={clave}
            type="button"
            role="tab"
            aria-selected={pestana === clave}
            className={pestana === clave ? 'activo' : ''}
            onClick={() => setPestana(clave)}
          >
            {texto} {listas[clave] && <span className="contador">{listas[clave].length}</span>}
          </button>
        ))}
      </div>

      <div className="filtros">
        <input
          type="search"
          className="campo"
          placeholder="Buscar por nombre o email"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          aria-label="Buscar por nombre o email"
        />
        <button type="button" className="btn btn-chico" onClick={() => setRecientesPrimero((v) => !v)}>
          {recientesPrimero ? 'Más recientes primero' : 'Más antiguas primero'}
        </button>
      </div>

      {aviso && <Aviso tipo="error" alCerrar={() => setAviso(null)}>{aviso}</Aviso>}
      <MensajeError error={error} alReintentar={cargar} />
      {!cargado && !error && <Cargando />}

      {cargado && grupos.length === 0 && (
        <p className="nota">
          {busqueda ? 'Ninguna cuenta coincide con la búsqueda.'
            : pestana === 'impagas' ? 'No hay cuentas impagas. ¡Todo al día!' : 'Todavía no hay cuentas pagadas.'}
        </p>
      )}

      {grupos.map(([fecha, cuentas]) => (
        <section key={fecha} className="tarjeta grupo-fecha">
          <div className="tarjeta-titulo">
            <h2 className="fecha-grupo">{fechaLarga(fecha)}</h2>
            <span className="nota">{plural(cuentas.reduce((s, c) => s + c.bebidas, 0), 'bebida')}</span>
          </div>
          <ul className="lista-cuentas">
            {cuentas.map((c) => (
              <li key={c.id} className="fila-cuenta">
                <Avatar foto={c.foto_url} nombre={c.nombre} />
                <div className="fila-cuenta-datos">
                  <span className="fila-cuenta-nombre">{c.nombre}</span>
                  <span className="nota">{c.email}</span>
                </div>
                <span className="fila-cuenta-bebidas">{plural(c.bebidas, 'bebida')}</span>
                <button
                  type="button"
                  className={`btn btn-chico ${c.pagada ? '' : 'btn-primario'}`}
                  disabled={guardando.has(c.id)}
                  onClick={() => cambiarPagada(c, !c.pagada)}
                >
                  {c.pagada ? 'Marcar no pagada' : 'Marcar pagada'}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
