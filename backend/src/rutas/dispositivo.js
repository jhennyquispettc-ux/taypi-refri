// Endpoints del ESP32 (header x-device-key)
import { Router } from 'express';
import { autenticarDispositivo } from '../auth.js';
import { registrarLectura, registrarApertura, registrarCorte, registrarCierre } from '../turnos.js';

const router = Router();
router.use(autenticarDispositivo);

function botellasValidas(valor) {
  return Number.isInteger(valor) && valor >= 0 && valor <= 100;
}

function numeroOpcional(valor) {
  return valor === null || valor === undefined ? null : Number(valor);
}

// POST /api/dispositivo/lectura  (cada 1 s)
// { botellas, temperatura, humedad, puerta_abierta } -> { turno, estado, sin_usuario }
router.post('/lectura', async (req, res) => {
  const { botellas, temperatura, humedad, puerta_abierta } = req.body ?? {};
  if (botellas !== null && !botellasValidas(botellas)) {
    return res.status(400).json({ error: 'botellas debe ser un entero entre 0 y 100' });
  }
  res.json(await registrarLectura({
    botellas,
    temperatura: numeroOpcional(temperatura),
    humedad: numeroOpcional(humedad),
    puerta_abierta: Boolean(puerta_abierta),
  }));
});

// POST /api/dispositivo/apertura | corte | cierre   { botellas }
const eventos = { apertura: registrarApertura, corte: registrarCorte, cierre: registrarCierre };
for (const [nombre, registrar] of Object.entries(eventos)) {
  router.post(`/${nombre}`, async (req, res) => {
    const { botellas } = req.body ?? {};
    if (!botellasValidas(botellas)) {
      return res.status(400).json({ error: 'botellas debe ser un entero entre 0 y 100' });
    }
    res.json(await registrar(botellas));
  });
}

export default router;
