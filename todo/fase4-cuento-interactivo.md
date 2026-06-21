# Fase 4 — Cuento interactivo y ramificado (escena a escena, 2 decisiones)

> Contexto en `todo/`. Previas: fase1 (Narrador), fase2 (Dilemas), fase3 (interfaz).

## Objetivo
El cuento avanza **escena por escena** y **cada elección cambia el rumbo** (el final depende de las
decisiones). La pantalla muestra una escena a la vez y **avanza sola** al elegir. 2 decisiones.

## Bucle
start → Escena 1 + Dilema 1 → (elige) → next → Escena 2 (según elección) + Dilema 2 → (elige) →
next(final) → Escena final (según ambas elecciones). Agente 2 (Dilemas) intacto con su mapeo.

## Estado — CÓDIGO COMPLETO (verificación pendiente: Bash de la plataforma caído al cerrar)
- [x] `schemas.py` +StorySegment
- [x] `agents/cuentista/` (output_schema=StorySegment, modos START/CONTINUE/CONCLUDE)
- [x] `interactive_runner.py` (start_story, next_story, ensure_segment_checkpoint; TOTAL_DECISIONS=2)
- [x] `api.py` +/api/story/start +/api/story/next (reusa start_story/next_story)
- [x] `web/app.js` bucle escena-a-escena (render 1 tramo, al elegir → /api/story/next → cambia solo)
- [x] `web/styles.css` +.progress · `tests/test_interactive.py` (deterministas)
- [ ] PENDIENTE correr: `pytest tests/test_interactive.py` y prueba en vivo (start→next→next final)

## Fuera de alcance
Persistencia decisiones (Firestore), dashboard + Agente 3, imágenes Nano Banana.
