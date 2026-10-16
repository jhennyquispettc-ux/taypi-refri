// Contexto de sesión: usuario actual, entrar() y salir()
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { googleLogout } from '@react-oauth/google';
import { api, alExpirarSesion, sesion } from '../lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Se arranca con lo guardado para que la app se vea al instante
  const [usuario, setUsuario] = useState(() => (sesion.token() ? sesion.usuario() : null));
  const [verificando, setVerificando] = useState(() => Boolean(sesion.token()));
  const [aviso, setAviso] = useState(null); // mensaje para la pantalla de login

  const salir = useCallback((mensaje = null) => {
    sesion.borrar();
    googleLogout();
    setUsuario(null);
    setAviso(mensaje);
  }, []);

  const entrar = useCallback((token, datosUsuario) => {
    sesion.guardar(token, datosUsuario);
    setUsuario(datosUsuario);
    setAviso(null);
  }, []);

  // Cualquier 401 del backend cierra la sesión
  useEffect(() => {
    alExpirarSesion(() => salir('Tu sesión expiró. Vuelve a ingresar.'));
  }, [salir]);

  // Al abrir la app se refrescan los datos del usuario (el rol pudo cambiar)
  useEffect(() => {
    if (!sesion.token()) return;
    api('/yo')
      .then((u) => {
        sesion.guardar(null, u);
        setUsuario(u);
      })
      .catch(() => { /* 401 ya cerró la sesión; sin red se usa lo guardado */ })
      .finally(() => setVerificando(false));
  }, []);

  const valor = useMemo(
    () => ({
      usuario,
      esAdmin: usuario?.rol === 'admin',
      // Sin datos guardados hay que esperar a /api/yo antes de mostrar nada
      cargando: verificando && !usuario,
      aviso,
      entrar,
      salir,
    }),
    [usuario, verificando, aviso, entrar, salir],
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
