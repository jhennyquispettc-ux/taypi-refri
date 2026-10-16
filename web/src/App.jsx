// Rutas de la aplicación. Las páginas de admin se cargan aparte (lazy)
// para que los clientes no descarguen Chart.js.
import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout.jsx';
import { RutaAdmin, RutaPrivada } from './components/Rutas.jsx';
import { Cargando } from './components/Comunes.jsx';
import Login from './pages/Login.jsx';
import Inicio from './pages/Inicio.jsx';
import Abrir from './pages/Abrir.jsx';

const Dashboard = lazy(() => import('./pages/admin/Dashboard.jsx'));
const Cuentas = lazy(() => import('./pages/admin/Cuentas.jsx'));

function Admin({ children }) {
  return (
    <RutaAdmin>
      <Suspense fallback={<Cargando />}>{children}</Suspense>
    </RutaAdmin>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RutaPrivada><Layout /></RutaPrivada>}>
        <Route index element={<Inicio />} />
        <Route path="abrir" element={<Abrir />} />
        <Route path="admin" element={<Admin><Dashboard /></Admin>} />
        <Route path="admin/cuentas" element={<Admin><Cuentas /></Admin>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
