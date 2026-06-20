# Backend — Perfil Emocional Infantil

Paso 1: base + **Agente 1 (Narrador)**. Python + Google ADK. Ver [`../todo/fase1-base-y-agente1-narrador.md`](../todo/fase1-base-y-agente1-narrador.md).

## Setup
```bash
python3.13 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements.txt
cp backend/.env.example backend/.env   # y pon tu GOOGLE_API_KEY cuando quieras correr en vivo
```

## Probar (sin key) — tests deterministas
```bash
backend/.venv/bin/python -m pytest backend/tests/test_taxonomy.py backend/tests/test_schemas.py backend/tests/test_profile.py
```
Valida la taxonomía (fuente única de verdad), los schemas y el guardrail de exclusión (C1) offline.

## Probar (con GOOGLE_API_KEY) — Agente 1 en vivo
```bash
# 1) Playground visual de ADK: elegir 'narrador', inyectar estado, ver el cuento generado
backend/.venv/bin/adk web backend/agents

# 2) Rúbrica C1-C8 sobre todos los casos (base, exclusión, edge)
backend/.venv/bin/adk eval backend/agents/narrador backend/eval/narrador_evalset.json --print_detailed_results

# 3) Tests en vivo (cero fugas de exclusión + estructura + sensibilidad)
GOOGLE_API_KEY=... backend/.venv/bin/python -m pytest backend/tests/test_narrador_live.py -v
```
Regenerar el evalset si cambian los casos: `backend/.venv/bin/python backend/eval/build_evalset.py`

## Mapa
| Archivo | Rol |
|---|---|
| `taxonomy.py` | Dimensión → subaxis → polos (esquema-datos.md §1). Fuente única de verdad. |
| `schemas.py` | `ChildProfile` (input) · `Story`/`StoryPage` (output del Narrador). |
| `profile.py` | Deriva la lista de exclusión desde los recuerdos de los padres. |
| `agents/narrador/` | Agente 1: `agent.py` (LlmAgent, output_schema=Story) + `prompts.py`. |
| `narrador_runner.py` | Corre el Narrador en aislamiento (InMemoryRunner) → `Story`. |
| `api.py` | FastAPI: API del producto, landing `/`, app `/app`, shell auth `/login`, assets estáticos. |
| `web/pages/` | `landing.html`, `app.html`, `login.html`. |
| `web/static/` | `app.js`, `styles.css`. |
| `tests/` | Deterministas (sin key) + en vivo (con key). |
| `eval/` | Casos + evalset nativo de ADK con rúbricas. |

**Gate para pasar al Agente 2:** C1 = cero fugas de exclusión + schema 100%.
