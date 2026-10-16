# Taypi Refri v2: contexto para Claude Code

Producto mínimo de un proyecto académico de IoT. En el README están la puesta en marcha y el flujo.

## Decisiones acordadas (no cambiarlas sin preguntar; el usuario prefiere lo simple pero determinista)

**Arquitectura**
- El backend es propio, en **Node + Express** y publicado en Render.
- La base de datos es **PostgreSQL de Supabase**, usado solo como base de datos: RLS activado sin políticas para cerrar su API automática.
- La web es React + Vite y se publica en Vercel. No se usa la API REST de Supabase ni Supabase Auth.

**Usuarios**
- Todos entran **con Google**: Google Identity Services envía un ID token, el backend lo verifica y devuelve un JWT propio.
- `usuarios.rol` vale `cliente` o `admin`. El primer admin se asigna por SQL.
- No hay perfiles ni edición de datos.

**Turnos**
- Solo un usuario a la vez: lo garantiza el índice único parcial `turnos_un_activo`.
- Hay **10 s para abrir** desde que se asigna el turno, más 2 s de gracia en el servidor.
- Dos formas de pedir el turno: el botón de la web y el QR del refrigerador (`/abrir`).

**Eventos del ESP32**
- El ESP32 envía `apertura` y `cierre` con la cantidad de botellas, y el backend calcula la diferencia.
- Si la puerta sigue abierta a los **2 min**, envía un `corte` (se cobra) y el turno sigue bloqueado para el mismo usuario hasta el cierre real.
- Los eventos se reintentan hasta recibir 200. No hay ids únicos: un evento repetido se ignora porque el estado del turno ya cambió.

**Cuentas**
- Hay **una cuenta por usuario y por día** (hora de Bolivia), que guarda solo la cantidad de bebidas y si está pagada. No hay montos.
- Tener cuentas impagas no bloquea el uso.
- Una devolución de un cliente resta de su cuenta, sin bajar de 0. Si el turno es de un admin, el aumento es una reposición y no se crea cuenta. Una apertura sin turno queda registrada con `usuario_id` null.

**Lecturas y web**
- El ESP32 hace un POST de **lectura cada 1 s** y **se guardan todas**. La respuesta trae el estado del turno para el LED.
- La web consulta cada 2 s (polling, sin WebSockets).
- El admin tiene un dashboard (gráficas de botellas y de temperatura con humedad) y una pantalla separada de cuentas (impagas y pagadas).

**Para la segunda entrega:** asociar cada usuario a una reserva.

## Hardware

| Componente | ESP32 |
|---|---|
| HX711 | DT a GPIO16, SCK a GPIO4 |
| MC-31 | GPIO27 con PULL_UP, y GND |
| DHT22 | GPIO15 |
| LED verde | GPIO25 |
| LED rojo | GPIO26 |

## Convenciones

- Código, comentarios e interfaz en español.
- La PC del usuario no tiene Python: los scripts se hacen en Node.
- Cualquier cambio al backend o al SQL debe pasar `cd backend && npm test` (API real contra PGlite).
