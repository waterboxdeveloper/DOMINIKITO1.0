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
VISION_MODEL = os.environ.get("NARRADOR_MODEL", "gemini-2.5-flash")  # describe el juguete desde la foto

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


def decode_data_uri(data_uri: str) -> tuple[str | None, bytes | None]:
    """Convierte un data-URI (o base64 pelado) en (mime, bytes). (None, None) si no se puede."""
    if not data_uri:
        return None, None
    raw = data_uri
    mime = "image/png"
    if data_uri.startswith("data:"):
        header, _, raw = data_uri.partition(",")
        mime = header[5:].split(";")[0] or "image/png"
    try:
        return mime, base64.b64decode(raw)
    except Exception:  # noqa: BLE001
        return None, None


def describe_toy(toy_data_uri: str) -> str:
    """Visión: describe el juguete de la foto en una frase corta (para que el narrador lo use)."""
    mime, data = decode_data_uri(toy_data_uri)
    if not data:
        return ""
    try:
        resp = _client_once().models.generate_content(
            model=VISION_MODEL,
            contents=[
                types.Part.from_bytes(data=data, mime_type=mime),
                types.Part(text=(
                    "Describe este juguete en UNA frase corta en español, para usarlo como personaje "
                    "en un cuento infantil: tipo de juguete, color y 1-2 rasgos distintivos. "
                    "Responde solo la descripción, sin preámbulos."
                )),
            ],
        )
        return (resp.text or "").strip()[:200]
    except Exception:  # noqa: BLE001
        return ""


def generate_image(prompt: str, ref_png: bytes | None = None, ref_mime: str | None = None) -> bytes | None:
    """Genera el PNG de un prompt (con sufijo de marca). Si hay `ref_png` (foto del juguete), la pasa
    como referencia para que el juguete salga fiel. Cachea por (prompt + referencia). None si falla."""
    if not prompt:
        return None
    full = f"{prompt}. Style: {BRANDING_SUFFIX}"
    key_src = full + ("|toy:" + hashlib.sha256(ref_png).hexdigest() if ref_png else "")
    key = hashlib.sha256(key_src.encode("utf-8")).hexdigest()
    if key in _cache:
        return _cache[key]
    if ref_png:
        contents = [
            types.Part.from_bytes(data=ref_png, mime_type=ref_mime or "image/png"),
            types.Part(text=(
                "Integra de forma natural y animada en la escena el juguete de la imagen de referencia, "
                "manteniendo su forma, color y rasgos distintivos. " + full
            )),
        ]
    else:
        contents = full
    for modalities in (["IMAGE"], ["TEXT", "IMAGE"]):
        try:
            resp = _client_once().models.generate_content(
                model=IMAGE_MODEL,
                contents=contents,
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


def attach_images(pages: list[dict], toy_data_uri: str = "") -> list[dict]:
    """Genera en paralelo la imagen de cada página y la adjunta como `page['image']` (data-URI|None).

    Si se pasa `toy_data_uri`, en las páginas marcadas con `show_toy` se usa la foto como referencia
    para que el juguete favorito aparezca fiel en la ilustración.
    """
    toy_mime, toy_png = decode_data_uri(toy_data_uri) if toy_data_uri else (None, None)

    def _gen(page: dict) -> bytes | None:
        prompt = page.get("image_prompt", "")
        if toy_png and page.get("show_toy"):
            return generate_image(prompt, ref_png=toy_png, ref_mime=toy_mime)
        return generate_image(prompt)

    workers = min(4, max(1, len(pages)))
    with ThreadPoolExecutor(max_workers=workers) as ex:
        results = list(ex.map(_gen, pages))
    for page, png in zip(pages, results):
        page["image"] = to_data_uri(png) if png else None
    return pages
