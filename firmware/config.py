# =====================================================================
# Taypi Refri - Configuración del ESP32
# Sube este archivo a la placa junto con los demás (Thonny).
# =====================================================================

# --- WiFi -------------------------------------------------------------
WIFI_SSID = "TU_RED_WIFI"
WIFI_PASSWORD = "TU_CONTRASEÑA_WIFI"

# --- Backend (Express en Render) --------------------------------------
API_URL = "http://192.168.31.130:3000/api/dispositivo"  # IP de tu PC en la red WiFi
DEVICE_KEY = "492a2e20084078edd6d608e2"  # igual a DEVICE_KEY de backend/.env

# --- Pines (ESP32 DevKit V1) ------------------------------------------
PIN_HX711_DT = 16    # marcado RX2 en la placa
PIN_HX711_SCK = 4
PIN_PUERTA = 27      # MC-31: un cable al pin, el otro a GND (PULL_UP interno)
PIN_DHT22 = 15
PIN_LED_VERDE = 25
PIN_LED_ROJO = 26

# Valor del pin del MC-31 con la puerta CERRADA. Verifícalo con prueba_sensores.py
PUERTA_CERRADA_VALOR = 0

# --- Calibración de la balanza -----------------------------------------
OFFSET = 19015.3744
ESCALA = 107.66404
PESO_BOTELLA = 362.03836  # gramos

# --- Tiempos ----------------------------------------------------------
INTERVALO_LECTURA_MS = 1000     # lectura enviada al backend
INTERVALO_DHT_MS = 5000         # el DHT22 necesita >= 2 s entre lecturas
SEGUNDOS_CORTE = 120            # puerta abierta: a los 2 min se envía el corte
DEBOUNCE_PUERTA_MS = 80
TIMEOUT_ESTABILIZAR_MS = 10000
HTTP_TIMEOUT_S = 5
