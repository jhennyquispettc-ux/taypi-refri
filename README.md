# Taypi Refri

Producto mínimo de control de bebidas por peso con IoT. Un refrigerador con balanza (ESP32 + celda de carga) cuenta botellas. Cada usuario entra con Google, abre el refrigerador desde la web o escaneando el QR que tiene pegado, y lo que saca se suma a su **cuenta del día**. El administrador ve en vivo las botellas, la temperatura y la humedad, y marca las cuentas como pagadas.

```
ESP32 (MicroPython) ──HTTPS──►  API Express (Render)  ──pg──►  PostgreSQL (Supabase)
  HX711 + celda, MC-31,              ▲
  DHT22, LEDs                        │ REST + JWT, polling 2 s
                                Web React (Vercel)
                                  /        cliente: cuenta de hoy + "Abrir refrigerador"
                                  /abrir   QR del refrigerador
                                  /admin   dashboard y cuentas
```

## Estructura

| Carpeta | Contenido |
|---|---|
| `firmware/` | MicroPython: `main.py`, `sensores.py`, `api.py`, `config.py`, `hx711.py`, `boot.py`, `prueba_sensores.py` |
| `backend/` | API Express: autenticación con Google, turnos, cuentas, dashboard. Pruebas en `test/` y simulador del ESP32 en `scripts/` |
| `sql/esquema.sql` | Las 4 tablas: `usuarios`, `cuentas`, `turnos`, `lecturas` |
| `web/` | React + Vite |
| `docs/` | Circuito, base de datos, flujo, API e informe |

## Cómo funciona

1. Te logueas con Google y tocas **Abrir refrigerador**, o escaneas el QR del refrigerador. Solo se puede si nadie lo está usando.
2. El backend busca tu cuenta de hoy (si no existe, la crea) y te da el turno. El LED verde se enciende y tienes **30 s** para abrir la puerta.
3. **Al abrir**, el ESP32 envía cuántas botellas había. **Al cerrar**, envía cuántas quedan. La diferencia se suma a tu cuenta.
4. Si la puerta sigue abierta a los **2 min**, el ESP32 envía un corte y se cobra lo sacado hasta ese momento. El refrigerador sigue siendo tuyo hasta que cierres la puerta, y lo que falte se cobra al cerrar.
5. El admin ve las cuentas impagas y las marca como pagadas.

| Caso | Qué pasa |
|---|---|
| Un cliente devuelve botellas | Se resta de su cuenta, sin bajar de 0 |
| El admin abre y hay más botellas | Es una reposición, no afecta ninguna cuenta |
| Se abre la puerta sin turno | Se registra como "sin usuario" y el LED rojo parpadea |
| Falla el envío de un evento | El ESP32 reintenta; si llega repetido, el backend lo ignora |

| LED | Significado |
|---|---|
| Verde fijo | Es tu turno: abre la puerta |
| Rojo fijo | Libre o en uso por otra persona |
| Rojo parpadeando | Puerta abierta sin turno |
| Verde y rojo parpadeando | Sin conexión |
| Verde parpadea un momento | Retiro registrado |

## Puesta en marcha

### 1. Base de datos (Supabase)
1. Crea un proyecto en [supabase.com](https://supabase.com).
2. En **SQL Editor**, ejecuta `sql/esquema.sql`.
3. En **Connect → Session pooler**, copia la cadena de conexión: es tu `DATABASE_URL`.

### 2. Google
1. En [Google Cloud Console](https://console.cloud.google.com), ve a **APIs y servicios → Credenciales** y crea un **ID de cliente OAuth** de tipo *Aplicación web*.
2. En **Orígenes de JavaScript autorizados**, agrega `http://localhost:5173` y la URL de Vercel.
3. Copia el **Client ID**.

### 3. Backend
```bash
cd backend
cp .env.example .env
npm install
npm test
npm run dev
```
Antes de arrancar, completa `.env` con la `DATABASE_URL`, el `GOOGLE_CLIENT_ID`, un `JWT_SECRET` y una `DEVICE_KEY` inventados, y `WEB_ORIGIN` con la URL de la web.

Para publicarlo en **Render**, crea un *Web Service* con *Root Directory* `backend`, *Build* `npm install` y *Start* `npm start`, y carga las mismas variables de entorno. En el plan gratis el servicio se duerme tras 15 min sin tráfico, pero el ESP32 le envía datos cada segundo y lo mantiene despierto.

### 4. Web
```bash
cd web
cp .env.example .env
npm install
npm run dev
```
Completa `.env` con `VITE_API_URL` y `VITE_GOOGLE_CLIENT_ID`. En **Vercel**, usa *Root Directory* `web` y las mismas variables.

### 5. Primer administrador
Entra una vez a la web con tu cuenta de Google y luego ejecuta en Supabase:
```sql
update usuarios set rol = 'admin' where email = 'tu-correo@gmail.com';
```

### 6. ESP32
1. Edita `firmware/config.py` con el WiFi, la `API_URL` (`https://<tu-api>.onrender.com/api/dispositivo`) y la `DEVICE_KEY`.
2. Sube todos los archivos de `firmware/` con Thonny.
3. Ejecuta `prueba_sensores.py` y ajusta `PUERTA_CERRADA_VALOR` al valor que muestre `pin` con la puerta cerrada.
4. Reinicia la placa.

Para probar sin hardware, con el backend corriendo:
```bash
cd backend
npm run simular
```

### 7. QR
- **QR de las mesas:** la URL de la web.
- **QR del refrigerador:** `<url-de-la-web>/abrir`.

## Conexiones

| Componente | ESP32 |
|---|---|
| HX711 DT / SCK | GPIO16 / GPIO4 |
| MC-31 | GPIO27 y GND |
| DHT22 datos | GPIO15 |
| LED verde / rojo | GPIO25 / GPIO26 (220 Ω a GND) |

Detalle completo en [docs/circuito.md](docs/circuito.md).

## Próxima entrega
- Asociar cada usuario a una reserva antes de poder usar el refrigerador.
- Limpiar las lecturas antiguas: el ESP32 guarda una por segundo, unas 86.000 por día.
