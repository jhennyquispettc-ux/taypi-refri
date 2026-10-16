# =====================================================================
# Taypi Refri - Programa principal del ESP32 (MicroPython)
#
# Cada 1 s envía una lectura (botellas, temperatura, humedad, puerta) y
# la respuesta dice si hay turno -> LED verde o rojo.
#
# Eventos (se reintentan hasta que el backend responde, en orden):
#   apertura -> botellas que había con la puerta cerrada
#   corte    -> si la puerta sigue abierta a los 2 min (se cobra lo sacado)
#   cierre   -> botellas al cerrar (se cobra lo que falte y se libera)
# =====================================================================
import time
import network
from machine import WDT
import config
import api
from sensores import Balanza, Puerta, Clima, Leds

print("Taypi Refri: iniciando...")
wlan = network.WLAN(network.STA_IF)
print("WiFi:", "conectado " + wlan.ifconfig()[0] if wlan.isconnected() else "SIN CONEXIÓN (revisa WIFI_SSID / WIFI_PASSWORD)")
print("Backend:", config.API_URL)
print("Midiendo la balanza (hasta 10 s)...")
balanza = Balanza()
puerta = Puerta()
clima = Clima()
leds = Leds()

pendientes = []            # eventos por enviar: (ruta, botellas)
conectado = False
sin_usuario = False        # el backend avisa que la puerta se abrió sin turno
abierta = False
t_abierta = 0
corte_enviado = False
botellas_cerrada = balanza.botellas_estables()  # último conteo con la puerta cerrada
botellas_actuales = botellas_cerrada
ultimas_cerrada = []
t_lectura = t_dht = t_wifi = 0


def vencido(t, intervalo_ms):
    return time.ticks_diff(time.ticks_ms(), t) >= intervalo_ms


def enviar_pendiente():
    """Intenta enviar el evento más antiguo; si falla, queda para el próximo ciclo."""
    global conectado
    ruta, botellas = pendientes[0]
    r = api.enviar(ruta, {"botellas": botellas})
    conectado = r is not None
    if r is None:
        return False
    print("->", ruta, botellas, r)
    pendientes.pop(0)
    if ruta == "cierre" and r.get("identificado") and r.get("sacadas", 0) > 0:
        leds.confirmar()
    return True


def enviar_lectura():
    global conectado, sin_usuario
    r = api.enviar("lectura", {
        "botellas": botellas_actuales,
        "temperatura": clima.temperatura,
        "humedad": clima.humedad,
        "puerta_abierta": abierta,
    })
    if r is not None and not conectado:
        print("Conectado al backend. Enviando lecturas cada 1 s.")
    conectado = r is not None
    if r:
        sin_usuario = r.get("sin_usuario", False)
        leds.modo = Leds.TURNO if r.get("turno") else Leds.LIBRE


print("Taypi Refri iniciando. Botellas:", botellas_cerrada)
clima.leer()
wdt = WDT(timeout=30000)  # reinicia la placa si el programa se cuelga

while True:
    wdt.feed()
    ahora_abierta = puerta.abierta()

    # --- Cambios de la puerta ---------------------------------------
    if ahora_abierta and not abierta:
        abierta = True
        t_abierta = time.ticks_ms()
        corte_enviado = False
        pendientes.append(("apertura", botellas_cerrada))
        print("Puerta ABIERTA, había", botellas_cerrada)

    elif not ahora_abierta and abierta:
        abierta = False
        botellas_cerrada = balanza.botellas_estables()
        botellas_actuales = botellas_cerrada
        ultimas_cerrada = []
        pendientes.append(("cierre", botellas_cerrada))
        print("Puerta CERRADA, quedan", botellas_cerrada)

    elif abierta and not corte_enviado and vencido(t_abierta, config.SEGUNDOS_CORTE * 1000):
        corte_enviado = True
        pendientes.append(("corte", balanza.botellas_estables(5000)))
        print("Corte automático a los 2 min")

    # --- Envíos ------------------------------------------------------
    if pendientes and wlan.isconnected():
        enviar_pendiente()

    if vencido(t_lectura, config.INTERVALO_LECTURA_MS):
        t_lectura = time.ticks_ms()
        botellas_actuales = balanza.botellas()
        if not abierta:
            # Solo se acepta como "antes" un conteo repetido 3 veces seguidas
            ultimas_cerrada = (ultimas_cerrada + [botellas_actuales])[-3:]
            if len(ultimas_cerrada) == 3 and ultimas_cerrada[0] == ultimas_cerrada[1] == ultimas_cerrada[2]:
                botellas_cerrada = botellas_actuales
        if wlan.isconnected():
            enviar_lectura()
        else:
            conectado = False
            if vencido(t_wifi, 10000):
                t_wifi = time.ticks_ms()
                try:
                    wlan.connect(config.WIFI_SSID, config.WIFI_PASSWORD)
                except OSError as e:
                    print("WiFi:", e)

    if vencido(t_dht, config.INTERVALO_DHT_MS):
        t_dht = time.ticks_ms()
        clima.leer()

    # --- LEDs --------------------------------------------------------
    if not conectado:
        leds.modo = Leds.OFFLINE
    elif abierta and sin_usuario:
        leds.modo = Leds.SIN_TURNO
    leds.actualizar()
    time.sleep_ms(20)
