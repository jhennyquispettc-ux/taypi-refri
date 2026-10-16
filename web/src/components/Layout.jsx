// Encabezado con navegación (los admins ven Dashboard y Cuentas)
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';

export function Layout() {
  const { esAdmin, salir } = useAuth();

  return (
    <div className="app">
      <header className="cabecera">
        <div className="cabecera-contenido">
          <NavLink to="/" className="marca">
            <img src="/favicon.svg" alt="" width="26" height="26" />
            Taypi Refri
          </NavLink>
          <nav className="nav" aria-label="Principal">
            {esAdmin && (
              <>
                <NavLink to="/" end>Inicio</NavLink>
                <NavLink to="/admin" end>Dashboard</NavLink>
                <NavLink to="/admin/cuentas">Cuentas</NavLink>
              </>
            )}
            <button type="button" className="nav-salir" onClick={() => salir()}>Salir</button>
          </nav>
        </div>
      </header>
      <main className="contenido">
        <Outlet />
      </main>
    </div>
  );
}
