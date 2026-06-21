# Fase 2 (Paso 2) — Agente 2 (Dilemas) + contrato pre-registrado + pruebas

> Carpeta `todo/`: contexto acumulado por fases. Ver fase previa en
> [`fase1-base-y-agente1-narrador.md`](./fase1-base-y-agente1-narrador.md).
> Paso 2 de [`../plan-desarrollo.md`](../plan-desarrollo.md). Contrato en
> [`../esquema-datos.md`](../esquema-datos.md) §2.

## Objetivo
El Agente 2 lee el `Story` del Narrador e inserta, en cada checkpoint, un **dilema con mapeo
pre-registrado**: cada opción de respuesta ya asignada a un polo conductual ANTES de que el niño
responda. Así, clasificar la respuesta luego = lookup (no interpretación). Materializa la separación
de motores (`idea.md §2/§8`).

## Estado — ✅ AGENTE 2 COMPLETADO Y VALIDADO EN VIVO
- [x] `development.py` (edad → estadio Ma/Erikson)
- [x] `schemas.py` extendido (AnswerOption, DilemmaDraft, DilemmaDraftSet, Dilemma)
- [x] `dilemas_postprocess.py` (valida vs taxonomía + enriquece)
- [x] Agente 2 (`agents/dilemas/`)
- [x] `dilemas_runner.py`
- [x] Fixtures de cuentos + evalset con rúbricas D1-D6
- [x] Tests deterministas en verde (31 passed)
- [x] Validación en vivo: `test_dilemas_live` PASSED — gate del Paso 2 cumplido (0 errores,
      1 dilema válido por checkpoint, polos distintos, sin fugas)

### Agente 1 endurecido ✅ (resuelto)
- [x] Garantía determinista `ensure_checkpoints()` en `narrador_runner.py`: si el LLM marca 0
      checkpoints, se fuerza la página 2 (y una intermedia en cuentos ≥5 págs); respeta los que el
      modelo sí marcó. 4 tests deterministas + el live `test_C4` ahora PASA.
- Suite total: **35 passed, 4 skipped** (los 4 skipped son live, corren con key).

## Decisión de diseño clave
Separar lo que produce el LLM de lo determinista:
- **LLM → borrador** (DilemmaDraft): dimensión, sub-eje, texto del dilema, opciones con su polo.
- **Código → enriquecimiento** (Dilemma): framework_refs, developmental_stage por edad, edad exacta,
  temas excluidos, ids. El modelo no inventa anclajes ni etiquetas.

## Gate para avanzar al Paso 3
100% de dilemas con mapeo válido (taxonomía + polos distintos) y cero toques a temas excluidos.

## Fuera de alcance (Paso 3)
Persistencia (Firestore), registro de la decisión del niño (lookup), Agente 3, dashboard, frontend.
