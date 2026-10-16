// Simulador del ESP32: envía lecturas cada 1 s y eventos por teclado,
// igual que firmware/main.py. Sirve para probar la web sin hardware.
//
// Uso: node --env-file=.env scripts/simular-esp32.mjs [URL_API]
//   URL por defecto: http://localhost:3000/api/dispositivo
// Comandos: a = abrir puerta | c <n> = cerrar con n botellas | k <n> = corte | q = salir
import readline from 'node:readline';

const URL = process.argv[2] ?? 'http://localhost:3000/api/dispositivo';
const KEY = process.env.DEVICE_KEY;
if (!KEY) { console.error('Falta DEVICE_KEY en .env'); process.exit(1); }

let botellas = 12;
let abierta = false;

async function enviar(ruta, datos) {
  const r = await fetch(`${URL}/${ruta}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-device-key': KEY },
    body: JSON.stringify(datos),
  });
  return r.json();
}

setInterval(async () => {
  try {
    const r = await enviar('lectura', {
      botellas,
      temperatura: +(4.5 + Math.random()).toFixed(1),
      humedad: +(55 + Math.random() * 8).toFixed(1),
      puerta_abierta: abierta,
    });
    process.title = `LED: ${r.sin_usuario ? 'rojo parpadea' : r.turno ? 'verde' : 'rojo'}`;
  } catch (e) {
    console.error('Sin conexión:', e.message);
  }
}, 1000);

const rl = readline.createInterface({ input: process.stdin });
console.log(`Simulando ESP32 contra ${URL}. Comandos: a | c <n> | k <n> | q`);
rl.on('line', async (linea) => {
  const [cmd, n] = linea.trim().split(/\s+/);
  try {
    if (cmd === 'q') process.exit(0);
    if (cmd === 'a') { abierta = true; console.log(await enviar('apertura', { botellas })); }
    if (cmd === 'k') { botellas = Number(n ?? botellas); console.log(await enviar('corte', { botellas })); }
    if (cmd === 'c') {
      botellas = Number(n ?? botellas);
      abierta = false;
      console.log(await enviar('cierre', { botellas }));
    }
  } catch (e) {
    console.error(e.message);
  }
});
