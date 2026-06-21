# Fase 3 (interfaz) — Crear cuento + lector del niño + capa API

> Contexto acumulado en `todo/`. Fases previas: [`fase1`](./fase1-base-y-agente1-narrador.md),
> [`fase2`](./fase2-agente2-dilemas.md). Estilo en [`../branding.md`](../branding.md).

## Objetivo
Interfaz Dominikito: los padres crean un cuento y el niño lo lee con las preguntas como botones.
**Punto clave:** el front consume una **capa API propia** (FastAPI) que envuelve los runners (con
post-procesado), NO el `/run` crudo de ADK. Request/response = mismos modelos Pydantic → match 1:1.

## Estado — ✅ INTERFAZ FUNCIONANDO
- [x] `backend/api.py` (FastAPI: /api/storybook, /api/storybook/sample, /api/decision stub, sirve web/)
- [x] `backend/web/index.html` (pantallas crear + lector)
- [x] `backend/web/styles.css` (branding Dominikito, portado del demo)
- [x] `backend/web/app.js` (fetch a la API, render, registro de decisiones, modo papás)
- [x] Verificado: estático 200, "Ver ejemplo" (fixtures) OK, y flujo real EN VIVO
      (POST /api/storybook → "Ana y el Dragón de Colores Valientes", 5 págs, 2 checkpoints,
      errores=[], exclusión de mudanza respetada). Servidor en http://127.0.0.1:8080

## Cómo levantar
`backend/.venv/bin/python backend/api.py`  → abrir http://127.0.0.1:8080

## Endpoints
- `POST /api/storybook` ← `ChildProfile` → `{story, dilemmas}` (generate_story+ensure_checkpoints,
  generate_dilemmas+enrich_and_validate).
- `GET /api/storybook/sample` → fixtures (instantáneo, sin costo).
- `POST /api/decision` → stub (persistencia = Paso siguiente).

## Fuera de alcance
Persistencia + registro real de decisiones, dashboard + Agente 3, imágenes Nano Banana,
migración a Next.js.
