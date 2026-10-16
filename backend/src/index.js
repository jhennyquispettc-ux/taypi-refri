import { cargarConfig } from './config.js';
import { conectar } from './db.js';
import { configurarAuth } from './auth.js';
import { crearApp } from './app.js';

const config = cargarConfig();
conectar(config.databaseUrl);
configurarAuth(config);

crearApp(config).listen(config.puerto, () => {
  console.log(`Taypi Refri API escuchando en el puerto ${config.puerto}`);
});
