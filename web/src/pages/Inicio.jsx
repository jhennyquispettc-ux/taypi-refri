// Página principal de cualquier usuario: refrigerador, cuenta de hoy e historial
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import { useRefrigerador } from '../hooks/useRefrigerador.js';
import { primerNombre } from '../lib/formato.js';
import { Aviso, Avatar, Cargando, MensajeError } from '../components/Comunes.jsx';
import { PanelRefrigerador } from '../components/PanelRefrigerador.jsx';
import { CuentaHoy, Historial } from '../components/MiCuenta.jsx';

export default function Inicio() {
  const { usuario, esAdmin } = useAuth();
  const { estado, error, aviso, pidiendo, ocupado, pedirTurno, cerrarAviso } = useRefrigerador();

  return (
    <div className="pila">
      <section className="saludo">
        <Avatar foto={usuario.foto_url} nombre={usuario.nombre} tamano={52} />
        <div>
          <p className="saludo-hola">Hola, {primerNombre(usuario.nombre)}</p>
          <p className="nota">{usuario.email}</p>
        </div>
      </section>

      {esAdmin && (
        <Link to="/admin" className="enlace-admin">Ir al dashboard de administración →</Link>
      )}

      {aviso && <Aviso tipo={aviso.tipo} alCerrar={cerrarAviso}>{aviso.texto}</Aviso>}
      {ocupado && <Aviso tipo="alerta">El refrigerador está en uso, intenta en un momento.</Aviso>}
      {error && estado && <MensajeError error={error} />}

      {!estado && !error && <Cargando />}
      {!estado && error && <MensajeError error={error} />}

      {estado && (
        <>
          <PanelRefrigerador estado={estado} pidiendo={pidiendo} alAbrir={pedirTurno} />
          <CuentaHoy cuenta={estado.cuenta_hoy} esAdmin={esAdmin} />
        </>
      )}

      <Historial />
    </div>
  );
}
