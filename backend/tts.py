"""Texto a voz con ElevenLabs — narración del cuento.

Generación BAJO DEMANDA (solo cuando el niño toca "Léemelo") para cuidar créditos. Devuelve MP3.
Cachea por (texto, voz) para no re-pagar repeticiones.

Requiere `ELEVENLABS_API_KEY` en el entorno (cargado por api.py desde backend/.env).
Voz y modelo configurables por env.
"""

from __future__ import annotations

import hashlib
import os

ELEVENLABS_MODEL = os.environ.get("ELEVENLABS_MODEL", "eleven_multilingual_v2")
# Voz por defecto (configurable). Usa GET /api/voices para listar las de tu cuenta y elegir una.
DEFAULT_VOICE_ID = os.environ.get("ELEVENLABS_VOICE_ID", "cgSgspJ2msm6clMCkdW9")  # "Jessica" (default compatible con plan Free)
OUTPUT_FORMAT = "mp3_44100_128"

import base64
import threading
import time

_cache_lock = threading.Lock()
_cache_timestamps: dict[str, dict] = {}
_generating_keys: set[str] = set()
_client = None


def _client_once():
    global _client
    if _client is None:
        from elevenlabs.client import ElevenLabs
        _client = ElevenLabs(api_key=os.environ.get("ELEVENLABS_API_KEY"))
    return _client


def group_characters_into_words(characters: list[str], start_times: list[float], end_times: list[float]) -> list[dict]:
    """Agrupa los timestamps de caracteres de ElevenLabs en palabras."""
    words = []
    current_word = []
    word_start = None
    
    for i, char in enumerate(characters):
        if char.isspace():
            if current_word:
                words.append({
                    "text": "".join(current_word),
                    "start": word_start,
                    "end": end_times[i - 1]
                })
                current_word = []
                word_start = None
        else:
            if not current_word:
                word_start = start_times[i]
            current_word.append(char)
            
    if current_word:
        words.append({
            "text": "".join(current_word),
            "start": word_start,
            "end": end_times[-1]
        })
        
    return words


def synthesize_with_timestamps(text: str, voice_id: str | None = None) -> dict | None:
    """Narra `text` con ElevenLabs y obtiene alineación de caracteres."""
    text = (text or "").strip()
    if not text:
        return None
    voice = voice_id or DEFAULT_VOICE_ID
    try:
        resp = _client_once().text_to_speech.convert_with_timestamps(
            text=text,
            voice_id=voice,
            model_id=ELEVENLABS_MODEL,
            output_format=OUTPUT_FORMAT,
        )
        if resp and resp.audio_base_64:
            words = []
            if resp.alignment:
                words = group_characters_into_words(
                    resp.alignment.characters or [],
                    resp.alignment.character_start_times_seconds or [],
                    resp.alignment.character_end_times_seconds or []
                )
            return {
                "audio_base_64": resp.audio_base_64,
                "words": words
            }
    except Exception as e:
        print(f"Error en ElevenLabs convert_with_timestamps: {e}")
        return None
    return None


def get_tts_data(text: str, voice_id: str | None = None) -> dict | None:
    """Obtiene datos de TTS (audio base64 y timestamps de palabras) de la caché o los genera."""
    text = (text or "").strip()
    if not text:
        return None
    voice = voice_id or DEFAULT_VOICE_ID
    key = hashlib.sha256(f"{voice}|{ELEVENLABS_MODEL}|{text}".encode("utf-8")).hexdigest()
    
    while True:
        with _cache_lock:
            if key in _cache_timestamps:
                return _cache_timestamps[key]
            if key not in _generating_keys:
                _generating_keys.add(key)
                break
        time.sleep(0.05)
        
    try:
        data = synthesize_with_timestamps(text, voice_id)
        if data:
            with _cache_lock:
                _cache_timestamps[key] = data
            return data
    finally:
        with _cache_lock:
            _generating_keys.remove(key)
            
    return None


def synthesize(text: str, voice_id: str | None = None) -> bytes | None:
    """Narra `text` con la voz dada (o la por defecto). Devuelve MP3, o None si falla."""
    data = get_tts_data(text, voice_id)
    if data and data.get("audio_base_64"):
        return base64.b64decode(data["audio_base_64"])
    return None



def list_voices() -> list[dict]:
    """Lista las voces de la cuenta para que el usuario elija una (id + nombre)."""
    try:
        resp = _client_once().voices.get_all()
        return [{"id": v.voice_id, "name": v.name} for v in resp.voices]
    except Exception:  # noqa: BLE001
        return []
