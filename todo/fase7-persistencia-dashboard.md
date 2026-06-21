# Fase 7 — Persistencia + Dashboard de padres

> Contexto en `todo/`. Implementa Contratos B (decisión) y C (agregado) de `esquema-datos.md`.
> Guía de setup en [`../FIRESTORE_SETUP.md`](../FIRESTORE_SETUP.md).

## Objetivo
Guardar niño/cuentos/decisiones (lookup del polo, sin LLM) y un dashboard de padres
protegido con PIN que muestra tendencias por dimensión con los umbrales de psicologia.md.

## Estado
- [x] `db_schema.sql` (children, stories, decisions)
- [x] `db.py` (cliente perezoso, no-op sin creds)
- [x] `aggregate.py` (Contrato C: umbrales, alert_level, neutral_summary)
- [x] `api.py`: /api/story/start devuelve child_id/story_id · /api/decision guarda · /api/children · /api/dashboard (PIN)
- [x] `web`: guarda decisión en choose() · pantalla Dashboard con PIN + barras de tendencia
- [x] `seed_demo.py` (demo sin gastar API) · `tests/test_aggregate.py`
- [x] Persistencia en la nube configurada + tablas creadas
- [x] Verificado en vivo: seed_demo (26 decisiones) → BD → build_dashboard agrega bien con umbrales
      (empatía/confianza=watch, autonomía=none, regulación=bajo umbral "sin datos suficientes")

## Decisiones
- Identidad demo: niño por nombre; dashboard protegido por `DASHBOARD_PIN` (env).
- `service_role` solo backend. Umbral mínimo de muestra = 5; `riesgo_cautela` nunca eleva alerta.

## Fuera de alcance (siguiente)
Agente 3 (chat de insights + derivación), escalamiento de alertas, cuentas/login reales, RLS.
