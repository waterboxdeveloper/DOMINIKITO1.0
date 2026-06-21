# dominikito 🐵🛸

**Perfil Emocional Infantil a través de Decisiones Narrativas.** Cuentos interactivos donde las
decisiones del niño dentro de la historia se convierten en señales emocionales y morales que los
padres podrán ver como patrones a lo largo del tiempo. **Nunca diagnostica** — describe patrones y
deriva a profesionales.

> Ruta "New Interfaces". La interfaz nueva: un cuento ramificado, narrado por voz, que es a la vez un
> instrumento de señal psicológica sin que el niño sienta que es evaluado.

## Cómo funciona

1. Los **padres** configuran el perfil del niño (edad, gustos, tema, "recuerdos" recientes).
2. El cuento se genera **escena a escena** y **ramifica según cada decisión** del niño (2 decisiones
   → final coherente con lo elegido).
3. En cada checkpoint, un agente inserta un **dilema con mapeo pre-registrado**: cada opción ya está
   asignada a un *polo conductual* (taxonomía CASEL + Ma 2013 + Erikson) **antes** de que el niño
   responda → clasificar la respuesta es un *lookup*, no interpretación (evita sesgo de confirmación).
4. Cada página tiene **ilustración** (Nano Banana) y se puede **leer en voz alta** (ElevenLabs).

## Arquitectura (lo que está implementado)

```
Landing pública (/) ──CTA──▶ /login (Google Auth) ──▶ App Dominikito (/app)
                                                     │
                          ┌──────────────────────────┼───────────────────────────┐
                          │ fetch (generación)        │ Firestore (persistencia, client-side)
                          ▼                           ▼
FastAPI (backend/api.py)                          stories + decisions → Firebase/Firestore
  /api/story/start · /api/story/next → agentes (ADK/Gemini)
  /api/tts · /api/voices             → ElevenLabs
  imágenes embebidas (data-URI)      → Nano Banana
```
El **dashboard** lee `decisions` de Firestore y agrega en el cliente con los umbrales de
`psicologia.md` (spec testeada en `backend/aggregate.py`). Ver [`FIRESTORE_SETUP.md`](./FIRESTORE_SETUP.md)
y [`consideraciones.md`](./consideraciones.md).

- **Backend / agentes:** Python + **Google ADK** (Gemini). Agente `cuentista` (narrador interactivo
  por tramos), `dilemas` (genera el dilema + mapeo de polos), post-procesado determinista que valida
  contra la taxonomía y enriquece.
- **Imágenes:** `gemini-2.5-flash-image` (Nano Banana), con estilo de marca.
- **Voz:** ElevenLabs `eleven_multilingual_v2`, bajo demanda.
- **Frontend:** estático (HTML/CSS/JS) servido por el mismo FastAPI. `/` es landing pública, `/app`
  es el producto, `/login?next=/app` es el shell preparado para Google Auth. (Migrable a Next.js a
  futuro.)

## Estructura

```
cuentos/
├── README.md            · este archivo
├── idea.md              · concepto del feature y guardrails
├── psicologia.md        · fundamento citable (CASEL/Ma/Erikson, umbrales)
├── esquema-datos.md     · contrato lógico-psicológico (dilema pre-registrado)
├── branding.md          · guía de marca dominikito
├── pruebas-agente1.md   · plan de pruebas del narrador
├── plan-desarrollo.md   · plan original (histórico; la arquitectura real es la de este README)
├── todo/                · bitácora por fases (fase1…fase6)
├── demo/                · demo de estilo estático (regenerable)
└── backend/
    ├── api.py           · FastAPI: endpoints + sirve web/
    ├── agents/          · cuentista, dilemas, narrador (ADK)
    ├── *.py             · taxonomy, schemas, runners, post-procesado, images, tts, ...
    ├── web/             · landing, app, static/ y assets/
    ├── eval/            · evalsets ADK + fixtures
    ├── tests/           · pytest (deterministas + en vivo)
    ├── requirements.txt · dependencias
    └── .env.example     · variables de entorno (copiar a .env)
```

## Correr localmente

```bash
cd backend
python3.13 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env        # y rellena tus claves (ver tabla abajo)
.venv/bin/python api.py     # → http://127.0.0.1:8080
```

Rutas principales:
- `http://127.0.0.1:8080/` → landing pública.
- `http://127.0.0.1:8080/login?next=/app` → placeholder temporal de Google Auth.
- `http://127.0.0.1:8080/app` → experiencia actual: crear cuento, lector, dashboard con PIN.

### Variables de entorno
| Variable | Requerida | Para qué |
|---|---|---|
| `GOOGLE_API_KEY` | sí | Gemini (texto e imágenes) |
| `NARRADOR_MODEL` / `DILEMAS_MODEL` | no | modelo de texto (def. `gemini-2.5-flash`) |
| `IMAGE_MODEL` | no | imágenes (def. `gemini-2.5-flash-image`) |
| `ELEVENLABS_API_KEY` | sí (para voz) | narración TTS |
| `ELEVENLABS_MODEL` / `ELEVENLABS_VOICE_ID` | no | voz/modelo de ElevenLabs |
| `HOST` / `PORT` | no | bind del servidor (deploy: `0.0.0.0` / `$PORT`) |

## Tests
```bash
cd backend
.venv/bin/python -m pytest tests/ -q          # deterministas (sin claves)
# en vivo (con claves): los tests *_live dejan de saltarse
```

## Deploy
- **Root del servicio:** `backend/`
- **Build:** `pip install -r requirements.txt`
- **Start:** `uvicorn api:app --host 0.0.0.0 --port $PORT`
- **Variables:** define las claves en el panel del host (NO subas `.env`).

## Guardrails (no negociables)
Nunca diagnostica · nunca da consejo psicológico · dimensiones ancladas a literatura citable ·
separación de motores (genera dilema ≠ clasifica ≠ agrega) · el niño nunca siente que es evaluado.

## Estado y roadmap
- ✅ Landing pública · shell de auth · cuento interactivo ramificado · dilemas con mapeo
  pre-registrado · imágenes Nano Banana · voz ElevenLabs · login con Google · persistencia Firestore
  (client-side) · dashboard de padres · branding dominikito.
- ⏳ Siguiente: agente de insights · (deuda técnica: mover la agregación al servidor, ver consideraciones.md).
