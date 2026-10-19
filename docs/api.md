# API REST (P3)

API propia en **Node 24 + Express 5**, publicada en Render. Todas las rutas empiezan con `/api` y hablan JSON (`Content-Type: application/json`, cuerpo máximo 10 kB).

> La rúbrica pide "API REST de Supabase u otro similar". En este proyecto la API REST es **propia** (Express): concentra la lógica del negocio (bloqueo de turnos, cuentas del día, diferencias de botellas) y los permisos, y usa PostgreSQL de Supabase solo como base de datos. La API REST automática de Supabase queda cerrada con RLS (ver `base_de_datos.md`).

En los ejemplos (bash):

```bash
API=https://taypi-refri-api.onrender.com/api   # o http://localhost:3000/api
TOKEN=eyJhbGciOi...                            # JWT devuelto por /auth/google
DEVICE_KEY=cambia-esta-clave-del-esp32        # igual a DEVICE_KEY del backend
```

## Autenticación

| Tipo | Quién | Cómo |
|---|---|---|
| Ninguna | cualquiera | `/api/salud`, `/api/auth/google` |
| JWT de usuario | web (cliente o admin) | `Authorization: Bearer <token>`. JWT propio firmado con `JWT_SECRET` (HS256), válido **7 días**, con `sub` = id del usuario. El rol se lee de la BD en cada petición |
| JWT + rol admin | dashboard | igual que el anterior y además `usuarios.rol = 'admin'` |
| Clave de dispositivo | ESP32 | header `x-device-key: <DEVICE_KEY>` (comparación en tiempo constante) |

## Errores comunes

Todas las respuestas de error tienen la forma `{ "error": "mensaje" }`.

| Código | Cuándo |
|---|---|
| 400 | Datos inválidos (falta `credential`, `botellas` fuera de 0–100, `pagada` no booleano, JSON mal formado) |
| 401 | Sin token / token inválido o expirado / usuario inexistente / clave de dispositivo incorrecta / token de Google inválido |
| 403 | Ruta de admin con un usuario `cliente` (`"Solo administradores"`) |
| 404 | Ruta inexistente (`"No encontrado"`) o cuenta inexistente |
| 409 | `POST /api/turno` con el refrigerador ocupado |
| 413 | Cuerpo de más de 10 kB |
| 500 | Error interno (`"Error interno"`, el detalle solo queda en el log) |

CORS: las rutas de la web solo aceptan los orígenes de `WEB_ORIGIN` (la URL de Vercel). Las rutas `/api/dispositivo/*` se montan antes de CORS porque el ESP32 no envía `Origin`.

---

## Salud

### `GET /api/salud`

Sin autenticación. Sirve para comprobar que el servicio está arriba (y para "despertar" Render).

```bash
curl $API/salud
```
```json
{ "ok": true }
```

---

## Autenticación y cliente

### `POST /api/auth/google`

Recibe el ID token de Google Identity Services, lo **verifica** con `google-auth-library` (`verifyIdToken`: firma de Google, expiración y `audience = GOOGLE_CLIENT_ID`), crea o actualiza el usuario y devuelve un JWT propio.

| | |
|---|---|
| Auth | ninguna |
| Body | `{ "credential": "<ID token de Google>" }` |

```bash
curl -X POST $API/auth/google -H "Content-Type: application/json" \
  -d '{"credential":"eyJhbGciOiJSUzI1NiIs..."}'
```
**200**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "usuario": { "id": 1, "email": "ana@gmail.com", "nombre": "Ana", "foto_url": "https://...", "rol": "cliente" }
}
```
Errores: `400 { "error": "Falta credential" }`, `401 { "error": "Token de Google inválido" }`, `401 { "error": "Cuenta de Google no válida" }` (sin email o email no verificado).

### `GET /api/yo`

Usuario de la sesión actual.

```bash
curl $API/yo -H "Authorization: Bearer $TOKEN"
```
**200** `{ "id": 1, "email": "ana@gmail.com", "nombre": "Ana", "foto_url": "...", "rol": "cliente" }`

Errores: 401.

### `GET /api/estado`

Estado del refrigerador, mi turno y mi cuenta de hoy. La web lo consulta **cada 2 s**.

```bash
curl $API/estado -H "Authorization: Bearer $TOKEN"
```
**200**
```json
{
  "refrigerador": {
    "en_uso": true,
    "en_linea": true,
    "puerta_abierta": false,
    "botellas": 10,
    "temperatura": 5.2
  },
  "mi_turno": { "estado": "pendiente", "segundos_restantes": 4 },
  "cuenta_hoy": { "id": 3, "fecha": "2026-10-15", "bebidas": 2, "pagada": false }
}
```
- `en_linea`: la última lectura del ESP32 tiene menos de 5 s.
- `mi_turno`: `null` si el turno activo no es mío o no hay; `segundos_restantes` solo en `pendiente`.
- `cuenta_hoy`: `null` si hoy todavía no pedí turno.

Errores: 401.

### `POST /api/turno`

Pide abrir el refrigerador (botón de la web o página `/abrir` del QR). Si el usuario es `cliente`, crea u obtiene su cuenta del día. Crea un turno `pendiente` con **30 s** para abrir.

```bash
curl -X POST $API/turno -H "Authorization: Bearer $TOKEN"
```
| Código | Body | Significado |
|---|---|---|
| 200 | `{ "ok": true, "motivo": "turno_asignado", "segundos": 5 }` | Turno asignado |
| 200 | `{ "ok": true, "motivo": "ya_es_tu_turno" }` | Ya tenía el turno activo |
| 409 | `{ "ok": false, "motivo": "ocupado" }` | Otro usuario tiene el turno (o lo ganó en el mismo instante: error 23505 del índice `turnos_un_activo`) |

Errores: 401.

### `GET /api/cuentas`

Mis últimas 30 cuentas (historial).

```bash
curl $API/cuentas -H "Authorization: Bearer $TOKEN"
```
**200** `[ { "id": 3, "fecha": "2026-10-15", "bebidas": 2, "pagada": false }, ... ]`

---

## Administrador

Todas requieren `Authorization: Bearer <token>` de un usuario con `rol = 'admin'`. Errores comunes: 401 y 403.

### `GET /api/admin/estado`

Turno activo (con nombre y rol del usuario) y última lectura. Polling cada 2 s en el dashboard.

```bash
curl $API/admin/estado -H "Authorization: Bearer $TOKEN"
```
**200**
```json
{
  "turno": {
    "id": 12, "usuario_id": 1, "cuenta_id": 3, "estado": "abierto",
    "creado_en": "...", "expira_en": "...", "abierto_en": "...", "cerrado_en": null,
    "botellas_inicio": 10, "botellas_corte": 10, "botellas_fin": null,
    "retiradas": 0, "corte_automatico": false,
    "usuario_nombre": "Ana", "usuario_rol": "cliente", "segundos_restantes": 0
  },
  "lectura": {
    "botellas": 9, "temperatura": 5.2, "humedad": 61.0,
    "puerta_abierta": true, "creado_en": "...", "en_linea": true
  }
}
```
`turno` y `lectura` pueden ser `null`.

### `GET /api/admin/lecturas?minutos=60`

Serie para las gráficas, agrupada con `date_bin` en **máximo ~300 puntos**. `minutos` entre 1 y 10 080 (7 días), por defecto 60.

Con `fecha=AAAA-MM-DD` (en lugar de `minutos`) devuelve **ese día completo** en hora de Bolivia, de 00:00 a 24:00 (un punto cada 288 s). Una fecha mal escrita o inexistente responde `400 { "error": "fecha debe tener el formato AAAA-MM-DD" }`.

```bash
curl "$API/admin/lecturas?minutos=60" -H "Authorization: Bearer $TOKEN"
curl "$API/admin/lecturas?fecha=2026-10-15" -H "Authorization: Bearer $TOKEN"
```
**200**
```json
[
  { "momento": "2026-10-15T14:00:00.000Z", "botellas": 10, "temperatura": 5.3, "humedad": 60.8, "puerta_abierta": false },
  { "momento": "2026-10-15T14:00:12.000Z", "botellas": 9,  "temperatura": 5.6, "humedad": 61.4, "puerta_abierta": true }
]
```

### `GET /api/admin/cuentas?pagada=false`

Cuentas con al menos una bebida, con su usuario. `pagada=true` lista las pagadas; cualquier otro valor, las impagas. Máximo 500, ordenadas por fecha descendente.

```bash
curl "$API/admin/cuentas?pagada=false" -H "Authorization: Bearer $TOKEN"
```
**200**
```json
[
  { "id": 3, "fecha": "2026-10-15", "bebidas": 2, "pagada": false, "pagada_en": null,
    "usuario_id": 1, "nombre": "Ana", "email": "ana@gmail.com", "foto_url": "..." }
]
```

### `PATCH /api/admin/cuentas/:id`

Marca una cuenta como pagada (o la desmarca).

| | |
|---|---|
| Body | `{ "pagada": true }` o `{ "pagada": false }` |

```bash
curl -X PATCH $API/admin/cuentas/3 -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"pagada":true}'
```
**200** `{ "id": 3, "fecha": "2026-10-15", "bebidas": 2, "pagada": true, "pagada_en": "2026-10-15T20:31:00.000Z" }`

Errores: `400 { "error": "pagada debe ser true o false" }`, `404 { "error": "Cuenta no encontrada" }`.

### `GET /api/admin/turnos?limite=50`

Historial de usos (turnos `abierto`, `cerrado` y `liberado`; no muestra los expirados). `limite` máximo 500.

Con `fecha=AAAA-MM-DD` devuelve solo los usos de ese día en hora de Bolivia (por la hora de apertura). Mismo `400` que `/admin/lecturas` si la fecha no es válida.

```bash
curl "$API/admin/turnos?limite=20" -H "Authorization: Bearer $TOKEN"
curl "$API/admin/turnos?fecha=2026-10-15&limite=500" -H "Authorization: Bearer $TOKEN"
```
**200**
```json
[
  { "id": 12, "estado": "cerrado", "abierto_en": "...", "cerrado_en": "...",
    "botellas_inicio": 10, "botellas_fin": 8, "retiradas": 2, "corte_automatico": false,
    "nombre": "Ana", "email": "ana@gmail.com", "rol": "cliente" }
]
```
`nombre`, `email` y `rol` son `null` en un uso sin usuario. En un turno de admin (reposición) `retiradas` es negativo.

### `POST /api/admin/liberar`

Cancela el turno activo (`pendiente` o `abierto`) si el refrigerador quedó trabado; pasa a `liberado`. No modifica cuentas.

```bash
curl -X POST $API/admin/liberar -H "Authorization: Bearer $TOKEN"
```
**200** `{ "ok": true }` (o `{ "ok": false }` si no había turno activo).

---

## Dispositivo (ESP32)

Todas requieren el header `x-device-key`. Errores comunes: `401 { "error": "Dispositivo no autorizado" }` y `400 { "error": "botellas debe ser un entero entre 0 y 100" }`.

### `POST /api/dispositivo/lectura`

Cada **1 s**. Guarda la lectura y responde el estado del turno para los LEDs.

| Campo | Tipo | |
|---|---|---|
| `botellas` | entero 0–100 o `null` | |
| `temperatura` | número o `null` | °C |
| `humedad` | número o `null` | % |
| `puerta_abierta` | boolean | |

```bash
curl -X POST $API/dispositivo/lectura -H "x-device-key: $DEVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"botellas":10,"temperatura":5.2,"humedad":60,"puerta_abierta":false}'
```
**200**
```json
{ "turno": true, "estado": "pendiente", "sin_usuario": false }
```
- `turno`: hay un turno activo con usuario → LED verde.
- `estado`: `libre`, `pendiente` o `abierto`.
- `sin_usuario`: la puerta se abrió sin turno → LED rojo parpadea.

### `POST /api/dispositivo/apertura`

La puerta se abrió. `botellas` = último conteo **estable** con la puerta cerrada.

```bash
curl -X POST $API/dispositivo/apertura -H "x-device-key: $DEVICE_KEY" \
  -H "Content-Type: application/json" -d '{"botellas":10}'
```
| Respuesta 200 | Caso |
|---|---|
| `{ "ok": true, "identificado": true }` | Había un turno `pendiente`: pasa a `abierto` |
| `{ "ok": true, "identificado": false }` | No había turno: se crea uno `abierto` sin usuario |
| `{ "ok": true, "repetido": true, "identificado": … }` | Reintento: el turno ya estaba `abierto` |

### `POST /api/dispositivo/corte`

La puerta lleva **2 min** abierta. Cobra lo sacado desde la apertura (o el último corte); el turno **sigue abierto y bloqueado**.

```bash
curl -X POST $API/dispositivo/corte -H "x-device-key: $DEVICE_KEY" \
  -H "Content-Type: application/json" -d '{"botellas":7}'
```
**200** `{ "ok": true, "sacadas": 1 }` o `{ "ok": true, "ignorado": true }` si no hay turno abierto.

### `POST /api/dispositivo/cierre`

La puerta se cerró. `botellas` = conteo estable al cerrar. Suma la diferencia a la cuenta del día (o la resta si devolvió, sin bajar de 0) y libera el refrigerador.

```bash
curl -X POST $API/dispositivo/cierre -H "x-device-key: $DEVICE_KEY" \
  -H "Content-Type: application/json" -d '{"botellas":8}'
```
**200** `{ "ok": true, "sacadas": 2, "identificado": true }` (`sacadas` es el total neto del uso, incluido el corte) o `{ "ok": true, "ignorado": true }` si es un reintento.

### Idempotencia de los eventos

El ESP32 reintenta cada evento hasta recibir 200, en orden. No hacen falta ids únicos: el estado del turno decide.

| Evento repetido | Qué pasa |
|---|---|
| `apertura` con el turno ya `abierto` | `repetido: true`, no cambia nada |
| `cierre` sin turno `abierto` | `ignorado: true`, no cobra dos veces |
| `corte` sin turno `abierto` | `ignorado: true` |

## Simulador del ESP32

Sin hardware, `backend/scripts/simular-esp32.mjs` envía lecturas y eventos como el ESP32:

```bash
cd backend && npm run simular
```
