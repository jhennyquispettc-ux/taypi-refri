// Gráficas del dashboard (Chart.js). Solo se importa desde páginas de admin.
import {
  Chart as ChartJS, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { hora } from '../../lib/formato.js';

// Sombrea en el fondo los tramos en que la puerta estuvo abierta
const sombraPuerta = {
  id: 'sombraPuerta',
  beforeDatasetsDraw(chart, _args, opciones) {
    const tramos = opciones?.tramos;
    if (!tramos?.length) return;
    const { ctx, chartArea: area, scales: { x } } = chart;
    ctx.save();
    ctx.fillStyle = opciones.color;
    for (const [inicio, fin] of tramos) {
      const x1 = Math.max(area.left, x.getPixelForValue(inicio));
      const x2 = Math.min(area.right, x.getPixelForValue(fin));
      if (x2 > x1) ctx.fillRect(x1, area.top, x2 - x1, area.bottom - area.top);
    }
    ctx.restore();
  },
};

ChartJS.register(LinearScale, PointElement, LineElement, Tooltip, Legend, Filler, sombraPuerta);

// Lee un color de las variables CSS (cambian con el modo claro/oscuro)
function color(nombre) {
  return getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
}

// Une puntos consecutivos con la puerta abierta en tramos [inicio, fin] (ms)
function tramosPuertaAbierta(puntos, pasoMs) {
  const tramos = [];
  for (const p of puntos) {
    if (!p.puerta_abierta) continue;
    const ultimo = tramos[tramos.length - 1];
    if (ultimo && p.t - ultimo[1] <= pasoMs) ultimo[1] = p.t + pasoMs;
    else tramos.push([p.t, p.t + pasoMs]);
  }
  return tramos;
}

function opcionesBase({ minutos, puntos, ejesY }) {
  const pasoMs = Math.max(1, Math.ceil((minutos * 60) / 300)) * 1000; // igual que el backend
  const ahora = Date.now();
  const texto = color('--texto-suave');
  const rejilla = color('--borde');
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false, // se redibuja cada 2 s
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { labels: { color: texto, boxWidth: 12 } },
      tooltip: { callbacks: { title: (items) => hora(items[0].parsed.x, true) } },
      sombraPuerta: { tramos: tramosPuertaAbierta(puntos, pasoMs), color: color('--puerta-sombra') },
    },
    scales: {
      x: {
        type: 'linear',
        min: ahora - minutos * 60_000,
        max: ahora,
        ticks: { color: texto, maxTicksLimit: 6, callback: (v) => hora(v) },
        grid: { color: rejilla },
      },
      ...ejesY(texto, rejilla),
    },
  };
}

export function GraficaBotellas({ lecturas, minutos }) {
  const puntos = lecturas.map((l) => ({ ...l, t: new Date(l.momento).getTime() }));
  const verde = color('--verde');
  const datos = {
    datasets: [{
      label: 'Botellas',
      data: puntos.map((p) => ({ x: p.t, y: p.botellas })),
      stepped: true,
      borderColor: verde,
      backgroundColor: `${verde}22`,
      fill: true,
      pointRadius: 0,
      borderWidth: 2,
    }],
  };
  const opciones = opcionesBase({
    minutos,
    puntos,
    ejesY: (texto, rejilla) => ({
      y: { beginAtZero: true, ticks: { color: texto, precision: 0 }, grid: { color: rejilla } },
    }),
  });
  return <div className="grafica"><Line data={datos} options={opciones} /></div>;
}

export function GraficaClima({ lecturas, minutos }) {
  const puntos = lecturas.map((l) => ({ ...l, t: new Date(l.momento).getTime() }));
  const datos = {
    datasets: [
      {
        label: 'Temperatura (°C)',
        data: puntos.map((p) => ({ x: p.t, y: p.temperatura })),
        borderColor: color('--temperatura'),
        backgroundColor: color('--temperatura'),
        yAxisID: 'y',
        pointRadius: 0,
        borderWidth: 2,
      },
      {
        label: 'Humedad (%)',
        data: puntos.map((p) => ({ x: p.t, y: p.humedad })),
        borderColor: color('--humedad'),
        backgroundColor: color('--humedad'),
        yAxisID: 'y1',
        pointRadius: 0,
        borderWidth: 2,
        borderDash: [5, 4],
      },
    ],
  };
  const opciones = opcionesBase({
    minutos,
    puntos,
    ejesY: (texto, rejilla) => ({
      y: {
        position: 'left',
        title: { display: true, text: '°C', color: texto },
        ticks: { color: texto },
        grid: { color: rejilla },
      },
      y1: {
        position: 'right',
        min: 0,
        max: 100,
        title: { display: true, text: '%', color: texto },
        ticks: { color: texto },
        grid: { drawOnChartArea: false },
      },
    }),
  });
  return <div className="grafica"><Line data={datos} options={opciones} /></div>;
}
