# Handoff — Landing pública + shell de Google Auth

Fecha: 2026-06-20

## Contexto rápido
Dominikito es una app de cuentos interactivos infantiles. El backend es Python/FastAPI + Google ADK
para agentes, Gemini/Nano Banana para imágenes, ElevenLabs para TTS, Supabase para persistencia y
dashboard de padres con PIN. El frontend actual es HTML/CSS/JS estático servido por FastAPI.

La tarea realizada fue reorganizar la web para que exista una landing pública antes de la app, sin
romper el flujo actual de cuento, dashboard ni APIs.

## Estado actual
Rutas principales:
- `/` → landing pública.
- `/login?next=/app` → shell temporal para Google Auth.
- `/app` → experiencia actual Dominikito: crear cuento, lector interactivo, dashboard con PIN.
- `/api/*` → endpoints existentes, sin cambio de contrato.

Contrato para Google Auth:
- El CTA de la landing apunta a `/login?next=/app`.
- Por ahora `login.html` muestra una pantalla temporal y permite continuar a `/app`.
- Cuando Google Auth esté listo, `/login` debe iniciar OAuth, crear sesión/cookie y redirigir al
  valor de `next`.

## Archivos relevantes
- `backend/api.py`
  - Agregadas rutas explícitas `/`, `/app`, `/login`.
  - Monta `/static` y `/assets`.
  - Mantiene aliases legacy `/index.html`, `/app.html`, `/styles.css`, `/app.js`.
- `backend/web/pages/landing.html`
  - Landing pública nueva.
- `backend/web/pages/app.html`
  - App original movida desde `backend/web/index.html`.
- `backend/web/pages/login.html`
  - Placeholder temporal de auth.
- `backend/web/static/app.js`
  - JS original movido desde `backend/web/app.js`.
- `backend/web/static/styles.css`
  - CSS original movido desde `backend/web/styles.css` + estilos de landing/login.
- `todo/fase8-landing-auth-shell.md`
  - Bitácora de esta fase.

Docs actualizados:
- `README.md`
- `SUPABASE_SETUP.md`
- `backend/README.md`

## Verificación ya corrida
Tests:
```bash
backend/.venv/bin/python -m pytest backend/tests/ -q
```

Resultado:
```text
48 passed, 6 skipped, 4 warnings
```

Checks HTTP con servidor local:
```text
GET /                         200
GET /app                      200
GET /login?next=/app          200
GET /static/app.js            200
GET /static/styles.css        200
GET /assets/logo.png          200
GET /api/storybook/sample     200
GET /api/children?pin=wrong   401
GET /styles.css               200
GET /app.js                   200
GET /app.html                 200
```

## Servidor local
El servidor fue levantado con:
```bash
backend/.venv/bin/python backend/api.py
```

URL:
```text
http://127.0.0.1:8080
```

Nota: en el entorno de Codex hizo falta permiso escalado para bindear `127.0.0.1:8080`.

## Pendientes sugeridos
1. Conectar Google Auth real en `/login`.
2. Proteger `/app` con sesión cuando Auth esté listo.
3. Decidir si el dashboard con PIN sigue dentro de `/app` o se mueve a `/dashboard` después.
4. Revisar visualmente la landing en móvil y desktop.
5. Si se despliega, confirmar que el host usa `uvicorn api:app --host 0.0.0.0 --port $PORT`.

## Guardrails que no se tocaron
- Agentes ADK.
- Taxonomía psicológica.
- Contrato de dilemas pre-registrados.
- `/api/story/start`, `/api/story/next`, `/api/decision`, `/api/dashboard`.
- Persistencia Supabase.
- TTS e imágenes.
