# Sensores y LEDs del refrigerador
from machine import Pin
import time
import dht
import config
from hx711 import HX711


class Balanza:
    """Celda de carga + HX711. Cuenta botellas iguales por peso."""

    def __init__(self):
        self.hx = HX711(config.PIN_HX711_DT, config.PIN_HX711_SCK)
        # Calibración fija: puede reiniciar con botellas encima sin hacer tara
        self.hx.offset = config.OFFSET
        self.hx.escala = config.ESCALA

    def botellas(self, n=5):
        gramos = self.hx.gramos(n)
        return max(0, round(gramos / config.PESO_BOTELLA))

    def botellas_estables(self, timeout_ms=config.TIMEOUT_ESTABILIZAR_MS):
        """Lee hasta obtener 3 conteos iguales seguidos (o el último si se acaba el tiempo)."""
        ultimas = []
        inicio = time.ticks_ms()
        while time.ticks_diff(time.ticks_ms(), inicio) < timeout_ms:
            ultimas = (ultimas + [self.botellas()])[-3:]
            if len(ultimas) == 3 and ultimas[0] == ultimas[1] == ultimas[2]:
                return ultimas[0]
        return ultimas[-1] if ultimas else self.botellas()


class Puerta:
    """Sensor magnético MC-31 con antirrebote."""

    def __init__(self):
        self.pin = Pin(config.PIN_PUERTA, Pin.IN, Pin.PULL_UP)
        self._estable = self.pin.value()
        self._candidato = self._estable
        self._t = time.ticks_ms()

    def abierta(self):
        valor = self.pin.value()
        ahora = time.ticks_ms()
        if valor != self._candidato:
            self._candidato = valor
            self._t = ahora
        elif valor != self._estable and time.ticks_diff(ahora, self._t) >= config.DEBOUNCE_PUERTA_MS:
            self._estable = valor
        return self._estable != config.PUERTA_CERRADA_VALOR


class Clima:
    """DHT22: temperatura y humedad dentro del refrigerador."""

    def __init__(self):
        self.sensor = dht.DHT22(Pin(config.PIN_DHT22))
        self.temperatura = None
        self.humedad = None

    def leer(self):
        try:
            self.sensor.measure()
            self.temperatura = round(self.sensor.temperature(), 1)
            self.humedad = round(self.sensor.humidity(), 1)
        except OSError as e:
            print("DHT22 sin respuesta:", e)  # se conserva la última lectura


class Leds:
    """Verde fijo: tienes turno, abre.     Rojo fijo: libre / en uso por otro.
    Rojo parpadeando: puerta abierta sin turno.   Ambos parpadeando: sin conexión.
    Verde parpadea: retiro registrado."""

    LIBRE, TURNO, SIN_TURNO, OFFLINE = range(4)

    def __init__(self):
        self.verde = Pin(config.PIN_LED_VERDE, Pin.OUT)
        self.rojo = Pin(config.PIN_LED_ROJO, Pin.OUT)
        self.modo = self.LIBRE
        self._confirmar_hasta = 0

    def confirmar(self):
        self._confirmar_hasta = time.ticks_add(time.ticks_ms(), 1200)

    def actualizar(self):
        ahora = time.ticks_ms()
        fase = (ahora // 300) % 2
        if time.ticks_diff(self._confirmar_hasta, ahora) > 0:
            verde, rojo = fase, 0
        elif self.modo == self.OFFLINE:
            verde, rojo = fase, fase
        elif self.modo == self.SIN_TURNO:
            verde, rojo = 0, fase
        elif self.modo == self.TURNO:
            verde, rojo = 1, 0
        else:
            verde, rojo = 0, 1
        self.verde.value(verde)
        self.rojo.value(rojo)
