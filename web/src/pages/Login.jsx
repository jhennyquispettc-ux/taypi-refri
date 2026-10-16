// Ingreso con Google. Después vuelve a la página que se quería ver (por ejemplo /abrir).
import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../hooks/useAuth.jsx';
import { api } from '../lib/api.js';
import { Aviso, Cargando } from '../components/Comunes.jsx';

export default function Login() {
  const { usuario, entrar, aviso } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  const desde = location.state?.desde ?? '/';
  const vieneDelQr = desde.startsWith('/abrir');

  if (usuario && !enviando) return <Navigate to={desde} replace />;

  async function alEntrarConGoogle(respuesta) {
    setEnviando(true);
    setError(null);
    try {
      const { token, usuario: u } = await api('/auth/google', {
        method: 'POST',
        body: { credential: respuesta.credential },
      });
      entrar(token, u);
      navigate(desde, { replace: true });
    } catch (e) {
      setError(e.message);
      setEnviando(false);
    }
  }

  return (
    <main className="centrado">
      <section className="tarjeta tarjeta-login">
        <img src="/favicon.svg" alt="" width="56" height="56" />
        <h1>Taypi Refri</h1>
        <p>
          {vieneDelQr
            ? 'Ingresa con tu cuenta de Google para abrir el refrigerador.'
            : 'Ingresa con tu cuenta de Google para sacar bebidas y ver tu cuenta.'}
        </p>

        {aviso && <Aviso tipo="alerta">{aviso}</Aviso>}
        {error && <Aviso tipo="error">{error}</Aviso>}

        {enviando ? (
          <Cargando texto="Ingresando…" />
        ) : (
          <div className="boton-google">
            <GoogleLogin
              onSuccess={alEntrarConGoogle}
              onError={() => setError('No se pudo ingresar con Google. Intenta de nuevo.')}
              text="signin_with"
              shape="pill"
              locale="es-419"
            />
          </div>
        )}
      </section>
    </main>
  );
}
