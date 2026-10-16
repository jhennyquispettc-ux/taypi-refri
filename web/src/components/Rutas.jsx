// Protección de rutas: sesión obligatoria y solo admin
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import { Cargando } from './Comunes.jsx';

export function RutaPrivada({ children }) {
  const { usuario, cargando } = useAuth();
  const location = useLocation();
  if (cargando) return <Cargando texto="Verificando sesión…" />;
  // Se recuerda a dónde quería ir (importante para el QR de /abrir)
  if (!usuario) return <Navigate to="/login" replace state={{ desde: location.pathname + location.search }} />;
  return children;
}

export function RutaAdmin({ children }) {
  const { esAdmin } = useAuth();
  if (!esAdmin) return <Navigate to="/" replace />;
  return children;
}
