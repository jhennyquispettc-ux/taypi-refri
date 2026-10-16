// Aplicación Express (separada de index.js para poder probarla)
import express from 'express';
import cors from 'cors';
import rutasCliente from './rutas/cliente.js';
import rutasAdmin from './rutas/admin.js';
import rutasDispositivo from './rutas/dispositivo.js';

export function crearApp(config) {
  const app = express();
  app.use(express.json({ limit: '10kb' }));

  // El ESP32 no envía Origin, así que CORS solo afecta a la web
  app.use('/api/dispositivo', rutasDispositivo);
  app.use(cors({ origin: config.webOrigins }));

  app.get('/api/salud', (req, res) => res.json({ ok: true }));
  app.use('/api/admin', rutasAdmin);
  app.use('/api', rutasCliente);

  app.use((req, res) => res.status(404).json({ error: 'No encontrado' }));
  // Express 5 pasa aquí los errores de las rutas async
  app.use((err, req, res, next) => {
    console.error(err);
    if (res.headersSent) return next(err);
    res.status(err.status ?? 500).json({ error: err.status ? err.message : 'Error interno' });
  });
  return app;
}
