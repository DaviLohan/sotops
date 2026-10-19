# Serviço de OCR

Serviço Python/FastAPI que reconhecerá o placar nas capturas de tela do eFootball.

**Estado atual (Fase 1):** somente a fundação — processo, verificação de saúde, testes e imagem
Docker. Não há nenhuma rota de reconhecimento. PaddleOCR, OpenCV, os modelos de layout e o
consumo da fila entram na Fase 4, conforme `docs/08-estrategia-ocr.md`.

## Desenvolvimento

```bash
python -m venv .venv
.venv/Scripts/activate        # Windows  (Linux/macOS: source .venv/bin/activate)
pip install -e ".[dev]"
pytest
ruff check .
uvicorn app.main:app --reload --port 8000
```
