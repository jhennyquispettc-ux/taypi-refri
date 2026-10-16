from machine import Pin, disable_irq, enable_irq
import time


class HX711:
    def __init__(self, dout, sck):
        self.dout = Pin(dout, Pin.IN, Pin.PULL_UP)
        self.sck = Pin(sck, Pin.OUT)
        self.sck.value(0)
        self.offset = 0
        self.escala = 1.0
        time.sleep_ms(100)
        self.leer()

    def listo(self):
        return self.dout.value() == 0

    def leer(self, timeout_ms=1000):
        inicio = time.ticks_ms()
        while not self.listo():
            if time.ticks_diff(time.ticks_ms(), inicio) > timeout_ms:
                raise OSError("El HX711 no responde. Revisa VCC, GND, DT y SCK")
            time.sleep_ms(1)
        valor = 0
        estado = disable_irq()
        for _ in range(24):
            self.sck.value(1)
            self.sck.value(0)
            valor = (valor << 1) | self.dout.value()
        self.sck.value(1)  # pulso 25, canal A, ganancia 128
        self.sck.value(0)
        enable_irq(estado)
        if valor & 0x800000:
            valor -= 0x1000000
        return valor

    def promedio(self, n=15):
        lecturas = sorted([self.leer() for _ in range(n)])
        corte = n // 4
        utiles = lecturas[corte:n - corte]
        return sum(utiles) / len(utiles)

    def tara(self, n=30):
        self.offset = self.promedio(n)

    def gramos(self, n=10):
        return (self.promedio(n) - self.offset) / self.escala
