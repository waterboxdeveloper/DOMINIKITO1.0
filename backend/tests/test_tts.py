"""Tests de TTS (ElevenLabs)."""

import os

import pytest

from tts import synthesize


def test_empty_text_returns_none():
    assert synthesize("") is None
    assert synthesize("   ") is None


def test_group_characters_into_words():
    from tts import group_characters_into_words
    chars = ["H", "o", "l", "a", ",", " ", "m", "u", "n", "d", "o", "!"]
    starts = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1]
    ends = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2]
    
    words = group_characters_into_words(chars, starts, ends)
    assert len(words) == 2
    assert words[0] == {"text": "Hola,", "start": 0.0, "end": 0.5}
    assert words[1] == {"text": "mundo!", "start": 0.6, "end": 1.2}


@pytest.mark.skipif(not os.environ.get("ELEVENLABS_API_KEY"),
                    reason="sin ELEVENLABS_API_KEY: test en vivo omitido")
def test_synthesize_live_returns_mp3():
    audio = synthesize("Hola, soy dominikito y te voy a contar un cuento.")
    assert audio is not None, "no se generó audio (revisa key/créditos)"
    assert len(audio) > 1000
    # MP3: empieza con 'ID3' (tag) o con un frame sync 0xFF 0xFB/0xF3/0xF2
    assert audio[:3] == b"ID3" or audio[0] == 0xFF


@pytest.mark.skipif(not os.environ.get("ELEVENLABS_API_KEY"),
                    reason="sin ELEVENLABS_API_KEY: test en vivo omitido")
def test_get_tts_data_live_has_timestamps():
    from tts import get_tts_data
    data = get_tts_data("Hola amigo")
    assert data is not None
    assert "audio_base_64" in data
    assert "words" in data
    assert len(data["audio_base_64"]) > 1000
    assert len(data["words"]) == 2
    assert data["words"][0]["text"] == "Hola"
    assert data["words"][1]["text"] == "amigo"
