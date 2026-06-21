# Fase 8 — Landing pública + shell para Google Auth

> Contexto en `todo/`. Fase previa: [`fase7`](./fase7-persistencia-dashboard.md).

## Objetivo
Separar la entrada pública del producto: `/` muestra una landing de dominikito, el CTA manda a
`/login?next=/app`, y la experiencia actual vive en `/app`. Google Auth real lo conecta otro flujo,
pero la landing ya respeta el contrato de rutas.

## Estado
- [x] `backend/web/pages/landing.html` — landing pública.
- [x] `backend/web/pages/app.html` — app actual movida sin cambiar el flujo.
- [x] `backend/web/pages/login.html` — placeholder temporal para Google Auth.
- [x] `backend/web/static/` — `app.js` y `styles.css`.
- [x] `backend/api.py` — rutas explícitas `/`, `/app`, `/login`, aliases legacy y mounts
      `/static` + `/assets`.

## Contrato con Auth
- CTA principal: `/login?next=/app`.
- Mientras auth no esté listo, `login.html` permite continuar a la demo.
- Cuando Google Auth esté listo, `/login` puede iniciar OAuth y redirigir al `next` después de crear
  sesión/cookie. La landing no necesita cambiar.

## Guardrails preservados
- `/api/*` no cambia.
- El dashboard con PIN sigue dentro de `/app`.
- La persistencia (Firestore) y el lookup de decisiones no se tocan.

## Verificación esperada
- `GET /` → landing.
- `GET /app` → app actual.
- `GET /login?next=/app` → shell de auth.
- `GET /api/storybook/sample` → JSON de fixture.
- Tests backend verdes.
