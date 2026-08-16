"""
Detector de mão no servidor — usado SÓ como plano B.

Quase todo mundo roda o MediaPipe no próprio navegador (WebGL), o que custa
zero e mantém a foto no aparelho da pessoa. Uma minoria não tem aceleração
gráfica ligada; para essa minoria, o navegador manda a foto para cá e recebe de
volta apenas os 21 pontos da mão.

Duas decisões que valem registro:
- A imagem NÃO é gravada em disco em momento algum. Entra, é analisada em
  memória e é descartada. A resposta são só coordenadas.
- Rodamos em CPU. Numa máquina de 8 vCPU isso dá folga de sobra para o volume
  que o fallback representa.

Como subir:
    python3 -m venv .venv && .venv/bin/pip install -r servidor/requirements.txt
    .venv/bin/uvicorn servidor.palma_api:app --host 0.0.0.0 --port 8077
"""

from __future__ import annotations

import base64
import binascii
import io
import os
import threading

import mediapipe as mp
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision
from PIL import Image
from pydantic import BaseModel, Field

LADO_MAX = 1024
TAMANHO_MAX_BYTES = 8 * 1024 * 1024

# O mesmo arquivo que o navegador usa — uma cópia só, sem versões divergindo.
MODELO = os.environ.get(
    "PALMA_MODELO",
    os.path.join(os.path.dirname(__file__), "..", "public", "mediapipe", "hand_landmarker.task"),
)

app = FastAPI(title="Palma API", version="1.0")

# Em produção, restrinja para o domínio do site.
origens = os.environ.get("PALMA_CORS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origens,
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

# O detector não é thread-safe; um lock simples evita corromper o grafo quando
# duas requisições chegam juntas. Para mais paralelismo, suba mais workers.
_lock = threading.Lock()
_detector = vision.HandLandmarker.create_from_options(
    vision.HandLandmarkerOptions(
        base_options=mp_python.BaseOptions(model_asset_path=os.path.abspath(MODELO)),
        running_mode=vision.RunningMode.IMAGE,
        num_hands=1,
        min_hand_detection_confidence=0.3,
        min_hand_presence_confidence=0.3,
    )
)


class Pedido(BaseModel):
    # data URL ("data:image/jpeg;base64,...") ou base64 puro.
    imagem: str = Field(min_length=32)


class Ponto(BaseModel):
    x: float
    y: float


class Resposta(BaseModel):
    achou: bool
    # Normalizados em 0..1 sobre a imagem enviada — quem chamou converte para
    # os pixels que estiver exibindo.
    landmarks: list[Ponto] = []


def _decodificar(imagem: str) -> Image.Image:
    if "," in imagem[:64] and imagem.lstrip().startswith("data:"):
        imagem = imagem.split(",", 1)[1]
    try:
        bruto = base64.b64decode(imagem, validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(status_code=400, detail="base64 inválido")
    if len(bruto) > TAMANHO_MAX_BYTES:
        raise HTTPException(status_code=413, detail="imagem grande demais")
    try:
        img = Image.open(io.BytesIO(bruto))
        img.load()
    except Exception:
        raise HTTPException(status_code=400, detail="não foi possível ler a imagem")
    return img.convert("RGB")


@app.get("/saude")
def saude() -> dict[str, str]:
    return {"estado": "ok"}


@app.post("/palma", response_model=Resposta)
def detectar(pedido: Pedido) -> Resposta:
    img = _decodificar(pedido.imagem)

    # Reduzir antes de detectar: acima de ~1024px não melhora e só gasta CPU.
    if max(img.size) > LADO_MAX:
        escala = LADO_MAX / max(img.size)
        img = img.resize((round(img.width * escala), round(img.height * escala)))

    quadro = mp.Image(image_format=mp.ImageFormat.SRGB, data=np.asarray(img))
    with _lock:
        saida = _detector.detect(quadro)

    if not saida.hand_landmarks:
        return Resposta(achou=False)

    pontos = [Ponto(x=float(p.x), y=float(p.y)) for p in saida.hand_landmarks[0]]
    return Resposta(achou=True, landmarks=pontos)
