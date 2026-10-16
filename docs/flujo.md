# Flujo del sistema

![Arquitectura](arquitectura.svg)

## Componentes

| Componente | Tecnología | Dónde corre |
|---|---|---|
| Dispositivo | ESP32 DevKit V1 + MicroPython | En el refrigerador |
| API REST | Node 24 + Express 5 | Render |
| Base de datos | PostgreSQL | Supabase (solo como BD) |
| Web | React + Vite, Chart.js | Vercel |
| Login | Google Identity Services + `google-auth-library` | Google / backend |

## Cómo entra el usuario

- **QR en las mesas** → abre la web (`/`): el cliente inicia sesión con Google y ve si el refrigerador está libre y su cuenta de hoy.
- **QR pegado en el refrigerador** → abre `/abrir`: tras iniciar sesión, la web **pide el turno de inmediato** (sin pulsar ningún botón).
- En `/`, el botón **"Abrir refrigerador"** solo aparece cuando está libre; al pedir el turno se muestra una **cuenta regresiva de 10 s**.

## Diagrama de secuencia de un uso completo

```mermaid
sequenceDiagram
    autonumber
    actor C as Cliente
    participant W as Web (React, Vercel)
    participant G as Google Identity Services
    participant A as API (Express, Render)
    participant DB as PostgreSQL (Supabase)
    participant E as ESP32 (refrigerador)
    actor AD as Admin

    C->>W: Escanea QR de la mesa (/) o del refrigerador (/abrir)
    W->>G: Acceder con Google
    G-->>W: ID token (credential)
    W->>A: POST /api/auth/google { credential }
    A->>G: verifyIdToken (firma + audience)
    A->>DB: insert ... on conflict (google_sub) do update
    A-->>W: { token: JWT 7 días, usuario }

    C->>W: Botón "Abrir refrigerador" (o /abrir automático)
    W->>A: POST /api/turno (Bearer JWT)
    A->>DB: expira pendientes vencidos y busca turno activo
    alt Refrigerador ocupado (o 23505 por carrera)
        A-->>W: 409 { ok: false, motivo: "ocupado" }
        W-->>C: "En uso, espera"
    else Libre
        A->>DB: crear/obtener cuenta de hoy (unique usuario_id, fecha)
        A->>DB: insert turno 'pendiente', expira_en = now() + 10 s
        A-->>W: 200 { motivo: "turno_asignado", segundos: 5 }
        W-->>C: Cuenta regresiva de 10 s
    end

    loop Cada 1 s
        E->>A: POST /api/dispositivo/lectura (x-device-key)
        A->>DB: insert lectura
        A-->>E: { turno: true, estado: "pendiente" }
    end
    E-->>C: LED verde fijo: es tu turno

    C->>E: Abre la puerta (MC-31)
    E->>A: POST /apertura { botellas: último conteo estable con la puerta cerrada }
    A->>DB: turno -> 'abierto', botellas_inicio = botellas_corte = n

    opt Puerta abierta 2 min
        E->>A: POST /corte { botellas }
        A->>DB: cuenta += botellas_corte - botellas, el turno sigue 'abierto' (bloqueado)
    end

    C->>E: Saca botellas y cierra la puerta
    E->>A: POST /cierre { botellas: conteo estable }
    A->>DB: cuenta.bebidas = greatest(0, bebidas + diferencia), turno -> 'cerrado'
    A-->>E: { sacadas, identificado: true }
    E-->>C: LED verde parpadea (retiro registrado)

    loop Polling cada 2 s
        W->>A: GET /api/estado
        A-->>W: refrigerador libre, cuenta_hoy.bebidas = +n
        AD->>A: GET /api/admin/estado, /admin/lecturas, /admin/turnos
    end

    AD->>A: PATCH /api/admin/cuentas/:id { pagada: true }
    A->>DB: pagada = true, pagada_en = now()
```

### Reglas clave

1. **Una cuenta por usuario y por día** (hora de Bolivia). Se crea al pedir el primer turno del día.
2. **10 s para abrir** desde que se asigna el turno; el servidor da **2 s de gracia** por la latencia (el ESP32 se entera del turno en ≤ 1 s mediante su lectura).
3. El ESP32 envía **`apertura`** con el último conteo estable con la puerta cerrada y **`cierre`** con el conteo estable al cerrar. El backend calcula la diferencia: `sacadas = botellas_corte − botellas`.
4. **Devolución**: si al cerrar hay más botellas, la diferencia es negativa y resta de la cuenta, **sin bajar de 0**.
5. **Turno de admin = reposición**: no se crea cuenta; el aumento queda registrado en `turnos.retiradas` (negativo).
6. **Corte a los 2 min**: si la puerta sigue abierta, se cobra lo sacado hasta ese momento y el turno **sigue bloqueado** para el mismo usuario hasta el cierre real.
7. **Apertura sin turno**: se registra un turno con `usuario_id = null` ("sin usuario"); el LED rojo parpadea.
8. **Reintentos**: el ESP32 guarda los eventos en una cola y los reenvía **en orden** hasta recibir 200. Un evento repetido se ignora porque el estado del turno ya cambió (una segunda `apertura` encuentra el turno ya `abierto`; un segundo `cierre` no encuentra turno abierto).
9. **Liberar**: si el refrigerador queda trabado, el admin puede liberar el turno activo (`liberado`).

## Estados de un turno

```mermaid
stateDiagram-v2
    [*] --> pendiente: POST /api/turno (usuario)
    [*] --> abierto: apertura sin turno (usuario_id null)
    pendiente --> abierto: ESP32 envía apertura
    pendiente --> expirado: no abrió en 10 s (+2 s de gracia)
    pendiente --> liberado: admin libera
    abierto --> abierto: corte a los 2 min (cobra, sigue bloqueado)
    abierto --> cerrado: ESP32 envía cierre (cobra la diferencia)
    abierto --> liberado: admin libera
    cerrado --> [*]
    expirado --> [*]
    liberado --> [*]

    note right of abierto
        pendiente y abierto son "activos":
        el índice turnos_un_activo permite
        solo uno a la vez
    end note
```

| Estado | Significado | ¿Bloquea el refrigerador? |
|---|---|---|
| `pendiente` | Pidió el turno; tiene 10 s para abrir | Sí |
| `abierto` | La puerta está abierta (con o sin usuario) | Sí |
| `cerrado` | Se cerró y se aplicó el cambio a la cuenta | No |
| `expirado` | No abrió a tiempo | No |
| `liberado` | Un admin lo canceló | No |

La expiración no usa tareas programadas: `expirarTurnos()` se ejecuta al inicio de cada operación (el ESP32 llama cada 1 s, la web cada 2 s), así que un turno vencido se libera en ~1 s.

## LEDs según el estado

| Situación | LED |
|---|---|
| Turno asignado a alguien (`turno: true`) | Verde fijo |
| Libre o en uso por otro | Rojo fijo |
| Puerta abierta sin turno (`sin_usuario: true`) | Rojo parpadeando |
| Sin WiFi o la API no responde | Ambos parpadeando |
| Cierre con retiro identificado | Verde parpadea ~1,2 s |

## Web

| Ruta | Quién | Contenido |
|---|---|---|
| `/` | Cliente | Login con Google; refrigerador libre / en uso; botón "Abrir refrigerador" solo si está libre; cuenta regresiva de 10 s; cuenta de hoy |
| `/abrir` | Cliente | Destino del QR del refrigerador: pide el turno de inmediato |
| `/admin` | Admin | KPIs, gráficas Chart.js (botellas en el tiempo; temperatura y humedad), polling cada 2 s, botón "Liberar refrigerador", últimos usos |
| `/admin/cuentas` | Admin | Cuentas impagas y pagadas; "Marcar pagada" |
