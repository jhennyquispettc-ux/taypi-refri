# Se ejecuta al encender, antes de main.py: conecta al WiFi.
# Si no logra conectar, main.py arranca igual y reintenta.
import network
import time
import config

wlan = network.WLAN(network.STA_IF)
wlan.active(True)

if not wlan.isconnected():
    print("Conectando a", config.WIFI_SSID, "...")
    wlan.connect(config.WIFI_SSID, config.WIFI_PASSWORD)
    inicio = time.ticks_ms()
    while not wlan.isconnected() and time.ticks_diff(time.ticks_ms(), inicio) < 15000:
        time.sleep_ms(250)

print("WiFi conectado:" if wlan.isconnected() else "Sin WiFi, se reintentará",
      wlan.ifconfig()[0] if wlan.isconnected() else "")
