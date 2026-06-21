"""Capa API de la interfaz Dominikito (FastAPI).

Envuelve los runners (con su post-procesado) y sirve la interfaz estática de `web/`. El front consume
ESTOS endpoints, no el `/run` crudo de ADK (que devolvería el borrador sin validar/enriquecer).

Request/response reutilizan los modelos de `schemas.py` → el contrato con el front es 1:1.

Levantar:  backend/.venv/bin/python backend/api.py   (uvicorn en http://127.0.0.1:8080)
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from dotenv import load_dotenv

BACKEND = Path(__file__).resolve().parent
sys.path.insert(0, str(BACKEND))
load_dotenv(BACKEND / ".env")  # carga GOOGLE_API_KEY para la generación en vivo

from fastapi import FastAPI, HTTPException, Response  # noqa: E402
from fastapi.responses import FileResponse  # noqa: E402
from fastapi.staticfiles import StaticFiles  # noqa: E402
from pydantic import BaseModel  # noqa: E402

from dilemas_runner import generate_dilemmas  # noqa: E402
from images import attach_images  # noqa: E402
from interactive_runner import next_story, start_story  # noqa: E402
from narrador_runner import generate_story  # noqa: E402
from schemas import ChildProfile  # noqa: E402
from tts import get_tts_data, list_voices, synthesize  # noqa: E402

# Persistencia: los cuentos y las DECISIONES se guardan client-side en Firestore (ver consideraciones.md).
# El backend ya NO toca la base de datos.


def _dump(obj):
    """Serializa modelos Pydantic (o None) a JSON-friendly."""
    return obj.model_dump(mode="json") if obj is not None else None


def _guard(fn, *args):
    """Ejecuta el runner y traduce errores comunes (cuota, etc.) a HTTP amable para el front."""
    try:
        return fn(*args)
    except Exception as e:  # noqa: BLE001
        s = str(e)
        if "RESOURCE_EXHAUSTED" in s or "429" in s:
            raise HTTPException(
                status_code=429,
                detail="Se agotó la cuota gratuita de Gemini por hoy. Usa 'Ver ejemplo', "
                "cambia de modelo (NARRADOR_MODEL/DILEMAS_MODEL) o activa facturación.",
            ) from e
        raise HTTPException(status_code=500, detail="Error generando el cuento: " + s[:200]) from e


class NextRequest(BaseModel):
    profile: ChildProfile
    story_so_far: list[str] = []
    choice: str = ""            # texto de la opción elegida (para continuidad narrativa)
    choices_made: int = 0       # decisiones tomadas hasta ahora (incluida la actual)


class TtsRequest(BaseModel):
    text: str
    voice_id: str | None = None

WEB_DIR = BACKEND / "web"
PAGES_DIR = WEB_DIR / "pages"
STATIC_DIR = WEB_DIR / "static"
ASSETS_DIR = WEB_DIR / "assets"
FIXTURES = BACKEND / "eval" / "fixtures"

app = FastAPI(title="Dominikito API")


@app.post("/api/storybook")
def storybook(profile: ChildProfile) -> dict:
    """Genera el cuento + sus dilemas (en vivo). Endpoint principal del lector."""
    story = generate_story(profile)                       # incluye ensure_checkpoints
    dilemmas, errors = generate_dilemmas(story, profile)  # incluye enrich_and_validate
    return {
        "story": story.model_dump(mode="json"),
        "dilemmas": [d.model_dump(mode="json") for d in dilemmas],
        "errors": errors,
    }


@app.get("/api/storybook/sample")
def storybook_sample() -> dict:
    """Cuento + dilemas de ejemplo (fixtures). Instantáneo, sin costo — para probar la UI."""
    story = json.loads((FIXTURES / "story_dino.json").read_text(encoding="utf-8"))
    dilemmas = json.loads((FIXTURES / "dilemmas_dino.json").read_text(encoding="utf-8"))["dilemmas"]
    return {"story": story, "dilemmas": dilemmas, "errors": []}


@app.post("/api/story/start")
def story_start(profile: ChildProfile) -> dict:
    """Abre el cuento interactivo: primer tramo (escena 1) + su dilema."""
    r = _guard(start_story, profile)
    seg = r["segment"].model_dump(mode="json")
    seg["pages"] = attach_images(seg["pages"])  # Nano Banana: ilustración por página
    return {
        "segment": seg,
        "dilemma": _dump(r["dilemma"]),
        "choices_made": r["choices_made"],
        "total": r["total"],
    }


@app.post("/api/story/next")
def story_next(req: NextRequest) -> dict:
    """Continúa el cuento según la elección del niño (o lo concluye si ya hubo 2 decisiones)."""
    r = _guard(next_story, req.profile, req.story_so_far, req.choice, req.choices_made)
    seg = r["segment"].model_dump(mode="json")
    seg["pages"] = attach_images(seg["pages"])  # Nano Banana: ilustración por página
    return {
        "segment": seg,
        "dilemma": _dump(r["dilemma"]),
        "done": r["done"],
        "choices_made": r["choices_made"],
    }


def _tts_response(text: str, voice_id: str | None) -> Response:
    audio = synthesize(text, voice_id)
    if not audio:
        raise HTTPException(status_code=502, detail="No se pudo generar el audio (revisa ELEVENLABS_API_KEY/créditos).")
    return Response(content=audio, media_type="audio/mpeg")


@app.post("/api/tts")
def tts_post(req: TtsRequest) -> Response:
    """Narra un texto con ElevenLabs y devuelve el audio MP3."""
    return _tts_response(req.text, req.voice_id)


@app.get("/api/tts")
def tts_get(text: str, voice_id: str | None = None) -> Response:
    """Versión GET (para usar como `src` de <audio> y evitar bloqueos de autoplay del navegador)."""
    return _tts_response(text, voice_id)


@app.get("/api/tts/timestamps")
def tts_timestamps(text: str, voice_id: str | None = None) -> dict:
    """Obtiene los timestamps de palabras de un texto para alineación de audio y texto."""
    data = get_tts_data(text, voice_id)
    if not data:
        raise HTTPException(status_code=502, detail="No se pudieron generar los timestamps (revisa key/créditos).")
    return {"words": data.get("words", [])}


@app.get("/api/voices")
def voices() -> dict:
    """Lista las voces de la cuenta de ElevenLabs (para elegir/configurar la voz)."""
    return {"voices": list_voices()}


# Las decisiones del niño y el dashboard se persisten/consultan client-side en Firestore.
# (Los endpoints /api/decision, /api/children y /api/dashboard se removieron en la migración.)


@app.get("/")
def landing_page() -> FileResponse:
    """Landing pública. El CTA apunta a /login?next=/app."""
    return FileResponse(PAGES_DIR / "landing.html")


@app.get("/app")
def app_page() -> FileResponse:
    """Experiencia Dominikito actual: creador, lector y dashboard con PIN."""
    return FileResponse(PAGES_DIR / "app.html")


@app.get("/login")
def login_page() -> FileResponse:
    """Shell temporal para Google Auth. Mantiene el contrato /login?next=/app."""
    return FileResponse(PAGES_DIR / "login.html")


@app.get("/index.html")
def legacy_index() -> FileResponse:
    """Alias legacy para hosts que pidan index.html."""
    return FileResponse(PAGES_DIR / "landing.html")


@app.get("/app.html")
def legacy_app_html() -> FileResponse:
    """Alias legacy para la app movida."""
    return FileResponse(PAGES_DIR / "app.html")


@app.get("/styles.css")
def legacy_styles() -> FileResponse:
    """Alias legacy mientras migramos referencias a /static/styles.css."""
    return FileResponse(STATIC_DIR / "styles.css")


@app.get("/app.js")
def legacy_app_js() -> FileResponse:
    """Alias legacy mientras migramos referencias a /static/app.js."""
    return FileResponse(STATIC_DIR / "app.js")


# Se montan al final para que /api/* y páginas explícitas tengan prioridad.
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
app.mount("/assets", StaticFiles(directory=str(ASSETS_DIR)), name="assets")


if __name__ == "__main__":
    import os

    import uvicorn

    uvicorn.run(
        app,
        host=os.environ.get("HOST", "127.0.0.1"),  # usa 0.0.0.0 en deploy
        port=int(os.environ.get("PORT", "8080")),
    )
