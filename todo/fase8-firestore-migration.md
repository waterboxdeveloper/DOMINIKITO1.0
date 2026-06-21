# Fase 8 — Migrar decisiones + dashboard a Firestore (client-side)

> Decisión y riesgos en [`../consideraciones.md`](../consideraciones.md). Setup en
> [`../FIRESTORE_SETUP.md`](../FIRESTORE_SETUP.md).

## Objetivo
Unificar la persistencia en Firestore (como ya hacían los cuentos). Las decisiones del niño se
guardan client-side en `decisions`; el dashboard lee de ahí y agrega en JS con los umbrales de
`psicologia.md`. La BD anterior fue eliminada del backend.

## Estado — ✅ COMPLETADO (código)
- [x] Backend: quitados `/api/decision`, `/api/children`, `/api/dashboard`; `/api/story/start` ya no
      crea niño/cuento; eliminados `db.py`, `seed_demo.py`, la guía de setup anterior; la dependencia de BD fuera de
      requirements; las variables de la BD anterior y `DASHBOARD_PIN` fuera de `.env(.example)`.
- [x] `aggregate.py` adelgazado a `aggregate_decisions` puro (spec; `test_aggregate.py` verde).
- [x] Front (`web/static/app.js`): `choose()` escribe decisión en Firestore (`decisions`); nuevos
      `aggregateDecisions`/`loadDecisions`/`loadUserChildren` (port exacto de aggregate.py);
      `dashLogin`/`loadChildDashboard` leen de Firestore. `renderDashboard` SIN tocar.
- [x] Docs: `FIRESTORE_SETUP.md` (reglas de seguridad), README actualizado.
- [x] Verificado: pytest 49 passed; app sirve; sin restos de `/api/decision|children|dashboard`.

### Pendiente del usuario
- [ ] Publicar las **Security Rules** de Firestore para `decisions` (ver FIRESTORE_SETUP.md).
- [ ] Probar en el navegador (con login): crear cuento → decisiones en Firestore → dashboard.

## Deuda técnica consciente
La lógica de umbrales corre en el cliente (manipulable). En producción debe ir al servidor
(firebase-admin / Cloud Functions). Registrado en `consideraciones.md`.
