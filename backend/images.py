"""Generación de ilustraciones con Nano Banana (modelo de imagen de Gemini).

Toma el `image_prompt` de cada página, le añade el sufijo de estilo de marca (`branding.md §7`) y
genera la imagen. Devuelve data-URI para embeber en la respuesta de la API. Si falla (cuota/error),
devuelve None y la página cae a un placeholder (el cuento no se rompe).
"""

from __future__ import annotations

import base64
import hashlib
import os
from concurrent.futures import ThreadPoolExecutor

from google import genai
from google.genai import types

IMAGE_MODEL = os.environ.get("IMAGE_MODEL", "gemini-2.5-flash-image")

# Sufijo de estilo (branding.md §7) para coherencia visual de marca.
BRANDING_SUFFIX = (
    "cute rounded expressive friendly characters, vibrant colors with soft shadows, "
    "playful and positive mood, purple and lilac dominant palette with yellow, orange and pink "
    "accents, clean cartoon style with soft outlines, gentle lighting, cream background, "
    "no text in the image"
)

_cache: dict[str, bytes] = {}
_client: genai.Client | None = None


def _client_once() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client()  # toma GOOGLE_API_KEY del entorno (cargado por api.py)
    return _client


def to_data_uri(png: bytes) -> str:
    return "data:image/png;base64," + base64.b64encode(png).decode("ascii")


def generate_image(prompt: str) -> bytes | None:
    """Genera el PNG de un prompt (con sufijo de marca). Cachea por prompt. None si falla."""
    if not prompt:
        return None
    full = f"{prompt}. Style: {BRANDING_SUFFIX}"
    key = hashlib.sha256(full.encode("utf-8")).hexdigest()
    if key in _cache:
        return _cache[key]
    for modalities in (["IMAGE"], ["TEXT", "IMAGE"]):
        try:
            resp = _client_once().models.generate_content(
                model=IMAGE_MODEL,
                contents=full,
                config=types.GenerateContentConfig(
                    response_modalities=modalities,
                    image_config=types.ImageConfig(
                        aspect_ratio="16:9"
                    ),
                ),
            )
            for cand in resp.candidates or []:
                parts = cand.content.parts if cand.content else []
                for part in parts or []:
                    blob = getattr(part, "inline_data", None)
                    if blob and blob.data:
                        _cache[key] = blob.data
                        return blob.data
        except Exception:  # noqa: BLE001  (cuota/red/modalidad: caemos a placeholder)
            continue
    return None


def attach_images(pages: list[dict]) -> list[dict]:
    """Genera en paralelo la imagen de cada página y la adjunta como `page['image']` (data-URI|None)."""
    prompts = [p.get("image_prompt", "") for p in pages]
    workers = min(4, max(1, len(pages)))
    with ThreadPoolExecutor(max_workers=workers) as ex:
        results = list(ex.map(generate_image, prompts))
    for page, png in zip(pages, results):
        page["image"] = to_data_uri(png) if png else None
    return pages
