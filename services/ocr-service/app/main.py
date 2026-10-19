"""Ponto de entrada do serviço de OCR.

Fase 1: apenas a fundação (processo, saúde e empacotamento). O reconhecimento de capturas,
os modelos de layout e o consumo da fila entram na Fase 4 — ver docs/08-estrategia-ocr.md.

O serviço nunca é exposto à internet: só a API principal fala com ele, pela rede interna.
Ele devolve dados reconhecidos e níveis de confiança; a homologação de resultados é
responsabilidade exclusiva da API.
"""

import time

from fastapi import FastAPI

from app import __version__

_started_at = time.monotonic()

app = FastAPI(
    title="Federação eFootball 1x1 — Serviço de OCR",
    version=__version__,
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)


@app.get("/health")
def health() -> dict[str, object]:
    """Liveness: o processo está respondendo."""
    return {
        "status": "ok",
        "version": __version__,
        "uptimeSeconds": round(time.monotonic() - _started_at),
    }
