# Plan de desarrollo por fases — Perfil Emocional Infantil

> ⚠️ **Documento histórico.** Este fue el plan original. La **arquitectura realmente implementada**
> (FastAPI sirviendo un front estático, cuento interactivo por tramos, Nano Banana, ElevenLabs) está
> descrita en [`README.md`](./README.md), y la bitácora real por fases en [`todo/`](./todo/).
> **IMPORTANTE:** las menciones a **Supabase** y a **Next.js** de abajo quedaron obsoletas — la
> persistencia real es **Firebase/Firestore (client-side)** y el front es estático. Ver `README.md`,
> `esquema-datos.md §6` y `consideraciones.md`.

> Plan de ejecución de la feature descrita en [`idea.md`](./idea.md), con el fundamento de
> [`psicologia.md`](./psicologia.md). Stack: **Python + Google ADK** (agentes) · **Next.js** (front)
> · **ElevenLabs** (TTS) · **Nano Banana 2.0 / Gemini** (imágenes) · **Supabase** (persistencia, Fase
> 2). Construido para un hackathon: Fase 1 = demo jugable; Fase 2 = señal + dashboard.

---

## 0. Prerrequisitos (credenciales y cuentas)

| Servicio | Para qué | Variable de entorno |
|---|---|---|
| Google AI / Gemini API key | Modelo de los agentes ADK + imágenes (Nano Banana 2.0) | `GOOGLE_API_KEY` |
| ElevenLabs API key | TTS del cuento | `ELEVENLABS_API_KEY` |
| Supabase (Fase 2) | DB + auth del dashboard | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |

- Python **3.11+** (requisito de ADK / `agents-cli`).
- Node 18+ para Next.js.

---

## 1. Estructura del repositorio

```
cuentos/
├── idea.md · psicologia.md · plan-desarrollo.md
├── backend/                      # Python + Google ADK
│   ├── agents/
│   │   ├── narrador/             # Agente 1
│   │   │   ├── agent.py          #   root_agent = LlmAgent(...)
│   │   │   └── prompts.py
│   │   ├── dilemas/              # Agente 2
│   │   │   ├── agent.py
│   │   │   └── prompts.py        #   incluye taxonomía CASEL+Ma+Erikson
│   │   └── insights/            # Agente 3 (Fase 2)
│   │       ├── agent.py
│   │       └── prompts.py
│   ├── schemas.py                # Pydantic: Story, InteractiveQuestion, ClassifiedDecision...
│   ├── taxonomy.py               # las 6 dimensiones + polos (fuente única de verdad)
│   ├── thresholds.py             # umbrales de psicologia.md (piso de muestra, normalización edad)
│   ├── db.py                     # cliente Supabase (Fase 2)
│   └── requirements.txt
└── frontend/                     # Next.js
    ├── app/
    │   ├── (padres)/onboarding/  # cuestionario + recuerdos
    │   ├── (padres)/dashboard/   # protegido con clave (Fase 2)
    │   └── (nino)/cuento/        # lector interactivo + TTS + preguntas
    ├── lib/api.ts                # llamadas a los endpoints ADK
    └── package.json
```

> Cada agente es un paquete con `root_agent` para que `adk api_server backend/agents/<x>` lo sirva.
> Servir los 3 desde un mismo `api_server` apuntando a la carpeta `agents/` (cada subcarpeta = un
> `app_name`).

---

## 2. Contratos de datos (lo crítico — define la integridad del feature)

El punto donde se juega el guardrail anti-sesgo (§2/§8): el **Agente 2 emite el mapeo pre-registrado**.
Definir estos schemas Pydantic *antes* de escribir prompts.

> ⚠️ **Superado por la implementación real:** la taxonomía vive en `backend/taxonomy.py` con la
> estructura rica de [`esquema-datos.md §1`](./esquema-datos.md) (dimensión → subaxis → polos, con
> `empatia` de 3 polos). El snippet binario de abajo quedó solo como bosquejo histórico.

```python
# bosquejo histórico (NO es la verdad — ver backend/taxonomy.py)
DIMENSIONS = {
  "regulacion_emocional": ("desregulado", "regulado"),
  "confianza_apego":      ("evita/desconfia", "se_acerca/pide_ayuda"),
  "honestidad":           ("evade/oculta", "asume/dice_verdad"),
  "empatia":              ("indiferente/agresivo", "empatico/ayuda"),
  "autonomia":            ("dependiente", "autonomo"),
  "riesgo_cautela":       ("cauto", "explorador"),  # secundaria: no escala alertas sola
}
```

```python
# Salida del Agente 2 — pre-registrada ANTES de que el niño responda
class AnswerOption(BaseModel):
    id: str                       # "A" / "B"
    text: str                     # lo que ve el niño
    dimension: str                # clave en DIMENSIONS
    polo: str                     # uno de los dos polos de esa dimensión

class InteractiveQuestion(BaseModel):
    page: int
    prompt: str                   # la pregunta dentro del cuento
    dimension: str
    options: list[AnswerOption]   # cada opción ya mapeada a un polo

# Cuando el niño elige, clasificar = lookup (no interpretación):
class ClassifiedDecision(BaseModel):
    child_id: str
    story_id: str
    dimension: str
    polo_elegido: str             # tomado del AnswerOption elegido
    timestamp: datetime
```

> Clasificar la `childAnswer` = leer el `polo` del `AnswerOption` que eligió. **No** se llama a un LLM
> para "interpretar" la respuesta. El Agente 3 (Fase 2) solo **agrega** estos registros.

---

## FASE 1 — Experiencia del cuento (demo jugable)

**Meta:** padres configuran al niño → se genera un cuento personalizado → el niño lo lee/escucha y
responde las preguntas de decisión. Sin diagnóstico, sin dashboard todavía.

### 1.1 Backend — Agente 1 (Narrador)
- `LlmAgent` (Gemini) con instrucción que usa **templating de estado** para contexto dinámico:
  `instruction = "Genera un cuento para {child_name}, edad {child_age}... Gustos: {child_likes}.
  Eventos recientes a tener en cuenta con cuidado (no forzar): {recent_events?}. Evita estos temas:
  {exclusion_list?}."`
- El front escribe el perfil en `session.state` (vía endpoint de sesiones) antes de llamar `/run`.
  Cambiar gustos = actualizar state = cambia el output. (idea.md §10)
- Salida estructurada: `Story` (páginas + texto + prompts de imagen para Nano Banana).

### 1.2 Backend — Agente 2 (Dilemas)
- Recibe **el `Story` del Agente 1** como input + la `taxonomy` y la lógica de `psicologia.md` en su
  system prompt (dimensiones, calibración por edad: estadio de Ma según `child_age`).
- `output_schema = list[InteractiveQuestion]` con el **mapeo pre-registrado**.
- Respeta la lista de exclusión (no generar dilemas sobre temas vetados).

### 1.3 Backend — servir
- `adk api_server backend/agents` → expone `POST /run`, `POST /run_sse`, sesiones, Swagger `:8000/docs`.
- Orquestación Fase 1: el front llama Narrador → con su salida llama Dilemas. (O un `SequentialAgent`
  que encadene ambos; para el demo, encadenar desde el front es más simple de depurar.)

### 1.4 Backend — Imágenes y TTS
- Imágenes: Gemini (Nano Banana 2.0) por cada `image_prompt` de la página.
- TTS: endpoint propio `/tts` (o llamada directa desde el front) a ElevenLabs; devuelve audio del
  texto de la página cuando el niño toca el botón de "leer en voz alta".

### 1.5 Frontend (Next.js)
- **Onboarding de padres:** form con perfil del niño (edad, sexo, gustos, intereses, temperamento) +
  caja de "recuerdos / eventos recientes" (texto libre simple, ej. "hoy se peleó por un juguete").
- **Pedir cuento:** los padres indican, simple, de qué quieren el cuento → dispara Agente 1 + 2.
- **Lector del niño:** páginas con ilustración + texto, botón **TTS (ElevenLabs)**, y en los
  checkpoints las **preguntas de decisión** (las opciones del `InteractiveQuestion`). El niño elige;
  la elección se guarda en memoria de sesión (persistencia real llega en Fase 2).

### ✅ Hito Fase 1 (demo)
Un niño genera un cuento sobre dinosaurios, lo escucha con TTS, llega a una decisión ("¿el dino
ayuda al amigo atascado o sigue jugando?") y elige — y por debajo esa elección ya quedó mapeada a
`empatia: empatico/ayuda`, lista para Fase 2.

---

## FASE 2 — Señal y dashboard

**Meta:** guardar el rastro, mostrar patrones a los padres en un panel protegido y un copiloto que
los interpreta con la lógica de `psicologia.md`. Nunca diagnostica.

### 2.1 Persistencia (Supabase)
Esquema mínimo:
```
children     (id, parent_id, name, age, sex, likes_jsonb, temperament, created_at)
life_events  (id, child_id, text, created_at)            -- recuerdos / lista de exclusión
stories      (id, child_id, theme, context_snapshot_jsonb, created_at)
decisions    (id, child_id, story_id, dimension, polo_elegido, created_at)  -- ClassifiedDecision
```
- Al terminar un cuento, persistir `stories` + las `decisions` (mapeo pre-registrado del Agente 2).
- `context_snapshot_jsonb` = foto del perfil al momento (para normalizar por edad exacta después).

### 2.2 Acceso protegido
- Dashboard bajo `/dashboard`, **protegido con clave/PIN** (Supabase Auth o un PIN simple para el
  demo). El niño nunca accede. (idea.md §5)

### 2.3 Agregación y umbrales (`thresholds.py`)
- Aplicar reglas de `psicologia.md §3`: **piso de ≥5–8 observaciones** por dimensión antes de mostrar
  tendencia; **normalizar por edad exacta**; mostrar siempre "n datos detrás".
- Calcular, por dimensión, la proporción de polos a lo largo del tiempo (ej. "7 de 8 evita conflicto").

### 2.4 Agente 3 (Copiloto de insights)
- `LlmAgent` con system prompt = lógica de `psicologia.md` + **guardrails duros** (nunca diagnostica,
  nunca aconseja, deriva a profesional).
- **Solo agrega y describe** los `decisions` ya clasificados (no reinterpreta respuestas).
- Responde preguntas de los padres en lenguaje neutro; cuando un patrón es sostenido o de alerta,
  recomienda consultar profesional (con directorio). **Alertas solo dentro del dashboard, sin push.**

### 2.5 Frontend dashboard
- Tendencias por dimensión (gráfico simple) con contador de muestra.
- Chat con el Agente 3 (vía `/run_sse` para streaming).

### ✅ Hito Fase 2 (demo)
Tras varios cuentos, el padre entra con su PIN, ve "evita el conflicto en 7 de 8 situaciones (8
datos)", le pregunta al copiloto qué significa, y este describe el patrón en términos neutros +
sugiere conversarlo con un profesional si persiste — sin etiquetar ni diagnosticar.

---

## 3. Dependencias

**Python (`backend/requirements.txt`):**
```
google-adk            # Agent Development Kit
google-genai          # Gemini (texto + imágenes)
pydantic
elevenlabs            # TTS
supabase              # Fase 2
python-dotenv
```

**Node (`frontend/package.json`):** `next`, `react`, `@supabase/supabase-js` (Fase 2),
cliente de fetch a los endpoints ADK, una lib de charts (ej. `recharts`) para el dashboard.

---

## 4. Orden de ataque sugerido (para el hackathon)

1. **Setup** (0): repos, env, `agents-cli` scaffolding, `adk api_server` levantando con un agente
   "hola mundo".
2. **Agente 1** funcionando con contexto dinámico (templating de estado) → cuento en JSON.
3. **Agente 2** sobre la salida del 1 → preguntas con mapeo pre-registrado (definir `taxonomy.py`
   primero).
4. **Front Fase 1**: onboarding → crear cuento → lector con TTS → preguntas. **← demo jugable.**
5. **Supabase**: schema + persistir stories/decisions.
6. **Dashboard protegido** + agregación con umbrales.
7. **Agente 3** copiloto sobre los datos agregados. **← demo completo.**

---

## 5. Riesgos / notas de integridad (no perder de vista)

- **Separación de motores:** Agente 2 (genera pregunta + mapeo) ≠ clasificación (lookup) ≠ Agente 3
  (agrega). Nunca el mismo prompt genera el dilema y "descubre" el patrón (idea.md §2).
- **Anti falso-positivo:** respetar piso de muestra y normalización por edad (`psicologia.md §3`).
- **Copy humilde:** patrones para conversar con un profesional, nunca screening ni diagnóstico.
- **El niño nunca siente que es evaluado:** la capa evaluativa vive en el dashboard con clave; para el
  niño todo es cuento.
