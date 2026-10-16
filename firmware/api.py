# Cliente HTTP del backend Express
import json
import config

try:
    import requests
except ImportError:
    import urequests as requests

_HEADERS = {"Content-Type": "application/json", "x-device-key": config.DEVICE_KEY}


def enviar(ruta, datos):
    """POST <API_URL>/<ruta>. Devuelve el JSON de respuesta o None si falló."""
    r = None
    try:
        try:
            r = requests.post(config.API_URL + "/" + ruta, data=json.dumps(datos),
                              headers=_HEADERS, timeout=config.HTTP_TIMEOUT_S)
        except TypeError:  # urequests antiguo sin timeout
            r = requests.post(config.API_URL + "/" + ruta, data=json.dumps(datos), headers=_HEADERS)
        if r.status_code != 200:
            print("HTTP", r.status_code, ruta, r.text[:120])
            return None
        return r.json()
    except Exception as e:
        print("Error de red en", ruta, ":", e)
        return None
    finally:
        if r is not None:
            r.close()
