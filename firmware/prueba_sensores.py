# Prueba de hardware: ejecútalo desde Thonny (F5) antes de usar main.py.
# Enciende los LEDs y muestra cada 2 s la puerta, el DHT22 y la balanza.
# El valor de "pin" con la puerta CERRADA va en config.PUERTA_CERRADA_VALOR.
import time
from machine import Pin
import config
from sensores import Balanza, Clima

pin_puerta = Pin(config.PIN_PUERTA, Pin.IN, Pin.PULL_UP)
verde = Pin(config.PIN_LED_VERDE, Pin.OUT)
rojo = Pin(config.PIN_LED_ROJO, Pin.OUT)
clima = Clima()
balanza = Balanza()

print("Prueba de LEDs: verde y luego rojo")
verde.value(1); time.sleep(1); verde.value(0)
rojo.value(1); time.sleep(1); rojo.value(0)

while True:
    valor = pin_puerta.value()
    clima.leer()
    gramos = balanza.hx.gramos(5)
    print("pin=%d (%s) | %s °C %s %% | %.1f g = %d botellas" % (
        valor, "CERRADA" if valor == config.PUERTA_CERRADA_VALOR else "ABIERTA",
        clima.temperatura, clima.humedad, gramos, balanza.botellas()))
    time.sleep(2)
