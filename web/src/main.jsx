import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { configFaltante, GOOGLE_CLIENT_ID } from './config.js';
import { AuthProvider } from './hooks/useAuth.jsx';
import { FaltaConfig } from './components/FaltaConfig.jsx';
import App from './App.jsx';
import './estilos.css';

const raiz = createRoot(document.getElementById('root'));

if (configFaltante.length > 0) {
  raiz.render(<FaltaConfig variables={configFaltante} />);
} else {
  raiz.render(
    <StrictMode>
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </GoogleOAuthProvider>
    </StrictMode>,
  );
}
