# Configurar Firestore — dominikito

La persistencia es **client-side** (ver [`consideraciones.md`](./consideraciones.md)): el navegador,
ya autenticado con Google (Firebase Auth), guarda en Firestore:
- **`stories`** — los cuentos (metadata + subcolección `pages`, imágenes/audio en Storage).
- **`decisions`** — las decisiones del niño (el perfil emocional). **Una doc por decisión:**
  `{ userId, childName, dimension, subaxis, pole, chosenOptionId, ageAtDecision, developmentalStage,
  dilemmaId, page, responseLatencyMs, createdAt }`.

El **dashboard** lee `decisions` del usuario y agrega en el cliente con los umbrales de
`psicologia.md` (mismos que `backend/aggregate.py`, que queda como spec testeada).

## Reglas de seguridad (Firebase Console → Firestore → Rules)
Cada usuario solo puede leer/escribir **sus propios** documentos:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Cuentos del usuario (+ subcolección de páginas)
    match /stories/{storyId} {
      allow read, write: if request.auth != null
        && (request.resource == null
            ? resource.data.userId == request.auth.uid
            : request.resource.data.userId == request.auth.uid);
      match /pages/{pageId} {
        allow read, write: if request.auth != null
          && get(/databases/$(database)/documents/stories/$(storyId)).data.userId == request.auth.uid;
      }
    }

    // Decisiones (perfil emocional)
    match /decisions/{decId} {
      allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
      allow read, update, delete: if request.auth != null && resource.data.userId == request.auth.uid;
    }
  }
}
```

> Publica las reglas con **Publish**. Si ya tenías una regla de `stories`, conserva la tuya y solo
> añade el bloque de `decisions`.

## Probar
1. Levanta la app: `cd backend && source .venv/bin/activate && python api.py`.
2. Abre `http://127.0.0.1:8080/`, entra con Google, crea un cuento y elige opciones.
3. En Firebase Console → Firestore, deberías ver documentos nuevos en **`decisions`**.
4. En la app: **📊 Dashboard** → PIN → elige al niño → tendencias (con 1 decisión dice "sin datos
   suficientes"; al cruzar 5 aparece la tendencia; `riesgo_cautela` nunca alarma).

## Config de Firebase
La config pública (apiKey, projectId, etc.) está en `backend/web/static/app.js` y `web/pages/login.html`.
Es **pública por diseño** (Firebase la protege con las Security Rules + Auth), no es un secreto.
