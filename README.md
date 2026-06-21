# dominikito 🐵🛸

<p align="center">
  <img src="logo.png" alt="Dominikito Logo" width="250" />
</p>

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
DOMINIKITO1.0/
├── README.md               · este archivo
├── LICENSE                 · Licencia de código abierto MIT
├── idea.md                 · concepto del feature y guardrails
├── psicologia.md           · fundamento citable (CASEL/Ma/Erikson, umbrales)
├── esquema-datos.md        · contrato lógico-psicológico (dilema pre-registrado)
├── branding.md             · guía de marca dominikito
├── consideraciones.md      · consideraciones técnicas e integración client-side
├── FIRESTORE_SETUP.md      · guía paso a paso para configurar Firebase Firestore
├── DEPLOYMENT.md           · notas sobre despliegue en GCP (Terraform + Cloud Run)
├── handoff-landing-auth.md · notas sobre la landing page y el flujo de autenticación
├── plan-desarrollo.md      · plan original (histórico; la arquitectura real es la de este README)
├── todo/                   · bitácora por fases (fase1…fase8)
├── demo/                   · demo de estilo estático (render_demo.py)
├── images/                 · imágenes locales de referencia de personajes y criaturas
├── firebase.json           · configuración de Firebase CLI
├── firestore.rules         · reglas de seguridad de Firestore
├── storage.rules           · reglas de seguridad de Firebase Storage
├── terraform/              · scripts de Terraform para aprovisionamiento GCP
└── backend/
    ├── api.py              · FastAPI: endpoints principales y servicio de web/
    ├── agents/             · agentes ADK (cuentista, dilemas, narrador)
    ├── *.py                · taxonomy, schemas, runners, tts, images, profile, aggregate...
    ├── web/                · frontend estático (landing, app, login) + assets/ y static/
    ├── eval/               · evalsets de ADK + fixtures de pruebas
    ├── tests/              · tests unitarios con pytest (deterministas y en vivo)
    ├── requirements.txt    · dependencias del backend
    └── .env.example        · variables de entorno de ejemplo (copiar a .env)
```

## Dependencias Principales

El proyecto requiere **Python 3.10 o superior** y utiliza las siguientes librerías core:
*   `google-adk`: Agent Development Kit de Google para construir, testear y evaluar agentes de IA.
*   `google-genai`: SDK oficial de Gemini para la generación de texto, dilemas e imágenes.
*   `elevenlabs`: API de ElevenLabs para la síntesis de voz (TTS) con marcas de tiempo por palabra.
*   `pydantic`: Validación de esquemas y modelos de datos.
*   `fastapi` / `uvicorn`: API del servidor y servicio del frontend estático.
*   `python-dotenv`: Carga de variables de entorno locales desde `.env`.
*   `cloudpickle`: Empaquetado local de los Reasoning Engines (agentes) para despliegue.

## Correr localmente

1. Configura el entorno virtual de Python e instala las dependencias:
   ```bash
   cd backend
   python3 -m venv .venv
   source .venv/bin/activate  # En Windows usa: .venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. Configura las variables de entorno:
   ```bash
   cp .env.example .env
   # Edita .env con tus llaves y configuraciones de servicios.
   ```

3. Levanta el servidor FastAPI local:
   ```bash
   python api.py  # Levanta el servidor en http://127.0.0.1:8080
   ```

Rutas principales:
- `http://127.0.0.1:8080/` → Landing pública.
- `http://127.0.0.1:8080/login?next=/app` → Autenticación mediante Google Sign-In.
- `http://127.0.0.1:8080/app` → Aplicación Dominikito (crear cuento, lector de libro interactivo, dashboard).

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

Para ejecutar las pruebas del backend:
```bash
cd backend
.venv/bin/pytest tests/ -q          # Pruebas unitarias deterministas (sin llamadas externas)
# Nota: Si configuras las claves correctas en .env, las pruebas unitarias que hacen llamadas en vivo (*_live) dejarán de saltarse.
```

## Deploy
- **Root del servicio:** `backend/`
- **Build:** `pip install -r requirements.txt`
- **Start:** `uvicorn api:app --host 0.0.0.0 --port $PORT`
- **Variables:** define las claves en el panel del host (NO subas `.env`). Para aprovisionamiento de infraestructura completa en GCP, consulta [`DEPLOYMENT.md`](./DEPLOYMENT.md) y usa la carpeta `terraform/`.

## Guardrails (no negociables)
Nunca diagnostica · nunca da consejo psicológico · dimensiones ancladas a literatura citable ·
separación de motores (genera dilema ≠ clasifica ≠ agrega) · el niño nunca siente que es evaluado.


## Estado y roadmap
- ✅ Landing pública · shell de auth · cuento interactivo ramificado · dilemas con mapeo
  pre-registrado · imágenes Nano Banana · voz ElevenLabs · login con Google · persistencia Firestore
  (client-side) · dashboard de padres · branding dominikito.
- ⏳ Siguiente: agente de insights · (deuda técnica: mover la agregación al servidor, ver consideraciones.md).

## Licencia

Este proyecto está bajo la Licencia MIT. Consulta el archivo [LICENSE](file:///Users/bbeltri/Documents/projects/Dominikito/DOMINIKITO1.0/LICENSE) para obtener más detalles.

