# Configurar Supabase (paso a paso) — dominikito

La persistencia (decisiones del niño → dashboard de padres) usa **Supabase** (Postgres gestionado).
Esto se hace **una vez**. ~5 minutos.

## 1. Crear el proyecto
1. Entra a **https://supabase.com** → **Start your project** → inicia sesión (GitHub sirve).
2. **New project**: ponle nombre (ej. `dominikito`), una **contraseña de BD** (guárdala) y región
   cercana. Crea. Espera ~1-2 min a que aprovisione.

## 2. Copiar las credenciales
1. En el proyecto → menú **Settings** (engranaje) → **API**.
2. Copia dos cosas:
   - **Project URL** → será `SUPABASE_URL`.
   - En **Project API keys**, la **`service_role`** (la secreta, "secret") → será
     `SUPABASE_SERVICE_ROLE_KEY`.
   > ⚠️ La `service_role` es secreta y todopoderosa: **solo va en el backend**, nunca en el front ni en git.

## 3. Crear las tablas
1. En el menú → **SQL Editor** → **New query**.
2. Abre `backend/db_schema.sql`, **copia todo** y pégalo en el editor.
3. **Run**. Debe decir "Success". (Crea las tablas `children`, `stories`, `decisions`.)

## 4. Poner las claves en el backend
En `backend/.env`:
```
SUPABASE_URL=https://xxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...   (la service_role)
DASHBOARD_PIN=1234                 (cámbialo por tu PIN)
```

## 5. Probar
```bash
cd backend
source .venv/bin/activate
python seed_demo.py          # siembra un niño "Demo Dominik" con decisiones de ejemplo
python api.py                # levanta la app
```
Abre **http://127.0.0.1:8080** → botón **📊 Dashboard** (arriba a la izquierda) → tu PIN →
elige **"Demo Dominik"** → deberías ver tendencias por dimensión.

> Si no configuras Supabase, la app **igual funciona** (cuento, voz, imágenes); simplemente no
> guarda decisiones ni muestra dashboard.

## En deploy
Define `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y `DASHBOARD_PIN` en las variables del host
(no en el repo).
