# Fase 1 (Paso 1) — Base del backend + Agente 1 (Narrador) + pruebas

> Carpeta `todo/`: aquí vive el plan de cada fase para tener contexto acumulado del desarrollo.
> Este es el **Paso 1** de [`../plan-desarrollo.md`](../plan-desarrollo.md), siguiendo la estrategia
> iterativa de [`../idea.md`](../idea.md) §11 (un agente a la vez, frontend al final).

## Estado — ✅ COMPLETADO (a la espera de GOOGLE_API_KEY para validación en vivo)
- [x] Estructura del backend creada
- [x] `taxonomy.py` (fuente única de verdad — de `esquema-datos.md §1`)
- [x] `schemas.py` (ChildProfile + Story/StoryPage)
- [x] `profile.py` (derive_exclusion_list)
- [x] Agente 1 Narrador (`agents/narrador/`) — ADK 2.3.0, LlmAgent output_schema=Story
- [x] Arnés de pruebas (`tests/` + `eval/narrador_evalset.json` con rúbricas C1-C8)
- [x] venv (Python 3.13) + dependencias instaladas
- [x] Tests deterministas en verde (20 passed, sin key)
- [x] Tests en vivo + `adk web` / `adk eval` listos (3 skipped; corren cuando haya `GOOGLE_API_KEY`)

### Pendiente del usuario para cerrar el gate
- [ ] Poner `GOOGLE_API_KEY` en `backend/.env` y correr: `adk web` (visual) · `adk eval` (rúbrica) ·
      `pytest test_narrador_live.py` (C1 cero fugas). Gate: C1 = 100% + schema 100% → pasar al Agente 2.

## Contexto y decisiones
- **Credenciales:** aún no hay `GOOGLE_API_KEY`. Se construye todo + arnés; los tests deterministas
  corren ya; los tests/eval en vivo quedan listos para cuando se ponga la key.
- **Alcance:** solo base + Agente 1. Parar y revisar antes del Agente 2.
- **Validación:** interfaz nativa de ADK (`adk web` visual + `adk eval` evalset) + pytest para los
  guardrails deterministas. Gate para avanzar: C1 = cero fugas de exclusión + schema 100%.

## Qué se construye

```
cuentos/backend/
├── .env.example              # GOOGLE_API_KEY=...
├── requirements.txt          # google-adk, google-genai, pydantic, python-dotenv, pytest
├── taxonomy.py               # dimensión → subaxis → polos (esquema-datos.md §1)
├── schemas.py                # ChildProfile (input), Story/StoryPage (output Agente 1)
├── profile.py                # derive_exclusion_list(recent_events)
├── agents/narrador/
│   ├── __init__.py           # expone root_agent
│   ├── agent.py              # LlmAgent(model=gemini-2.5-flash, output_schema=Story)
│   └── prompts.py            # system prompt con {state} templating
├── tests/
│   ├── test_taxonomy.py      # determinista (sin key)
│   ├── test_schemas.py       # determinista (sin key)
│   └── test_narrador_live.py # requiere key
└── eval/
    └── narrador_evalset.json # casos B1-B3, E1-E5, X1-X5 de pruebas-agente1.md
```

## Fuera de alcance (siguiente fase)
Agente 2 (Dilemas) + contrato pre-registrado, Agente 3, persistencia (Firestore), frontend,
imágenes (Nano Banana), TTS (ElevenLabs).

## Verificación
- **Ahora:** `pytest backend/tests/test_taxonomy.py backend/tests/test_schemas.py` → verde.
- **Con key:** `adk web backend/agents` (visual) · `adk eval backend/agents/narrador
  backend/eval/narrador_evalset.json` · `pytest backend/tests/test_narrador_live.py`.
