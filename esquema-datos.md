# Esquema Lógico-Psicológico de Datos — el puente del feature

> Contrato de datos central de [`idea.md`](./idea.md), anclado a [`psicologia.md`](./psicologia.md).
> Define **qué emite el Agente 2 al crear un dilema** (mapeo pre-registrado), **qué se guarda cuando
> el niño responde** (lookup, sin texto libre) y **qué consume el Dashboard** para pintar tendencias.
> Principio rector: la clasificación es **datos duros, no interpretación de la IA**. El Agente 2
> pre-registra el impacto de cada opción *antes* de que el niño elija; nadie "interpreta" la respuesta
> después. Esto neutraliza el sesgo de confirmación (guardrail §8).

---

## 0. Las 4 piezas de información que pide el feedback

Cada dilema presentado guarda:
1. **Dimensión** (CASEL / psicológica) — el constructo principal que el dilema toca.
2. **Sub-categoría / eje** — el matiz conductual dentro de esa dimensión.
3. **Mapeo de opciones → polos** — cada opción de respuesta pre-asignada a un polo conductual.
4. **Metadatos** — sobre todo la **edad exacta** del niño al momento (para normalizar la "normalidad"
   del desarrollo en el Dashboard) + trazabilidad de la lista de exclusión.

---

## 1. Taxonomía: fuente única de verdad (dimensión → eje → polos)

Anclada a `psicologia.md §2`. Los **polos son descriptivos del comportamiento, NO juicios clínicos**
(no marcamos "bueno/malo" ni "sano/preocupante" a nivel de opción — eso sería interpretar y sembrar
el patrón). La señal de alerta **emerge solo del patrón agregado + umbrales**, nunca de una opción
suelta. Algunas dimensiones tienen 2 polos; otras (ej. reacción al conflicto) tienen 3.

| `dimension` | `subaxis` (ejemplos) | `poles` (valores permitidos) | Anclaje |
|---|---|---|---|
| `regulacion_emocional` | `frustracion`, `miedo_a_lo_desconocido` | `regulado` · `desregulado` | CASEL self-management · Erikson |
| `confianza_apego` | `apego`, `pedir_ayuda_vs_resolver_solo` | `busca_vinculo` · `evita_desconfia` | Bowlby · CASEL relationship |
| `honestidad` | `decir_verdad_incomoda`, `asumir_error` | `asume_transparente` · `evade_oculta` | CASEL resp. decision · Ma |
| `empatia` | `reaccion_al_conflicto`, `dano_a_otro` | `prosocial_asertivo` · `pasivo_evitativo` · `reactivo_agresivo` | CASEL social awareness · Ma |
| `autonomia` | `decidir_solo_vs_guia` | `autonomo` · `dependiente` | Erikson autonomía/iniciativa |
| `riesgo_cautela` ⚠️ | `explorar_vs_quedarse_seguro` | `explorador` · `cauto` | Erikson (secundaria: **no escala alertas sola**) |

> Esta tabla se implementa como `taxonomy.py` en el backend. El Agente 2 **solo puede usar valores de
> aquí**; cualquier `dimension`/`subaxis`/`pole` fuera de esta lista = dilema inválido (rechazar).

---

## 2. Contrato A — Dilema pre-registrado (salida del Agente 2)

Lo que el Agente 2 produce **al crear el dilema, antes de que el niño responda**. Es la pieza que
elimina la interpretación post-hoc.

```jsonc
{
  "dilemma_id": "uuid",
  "story_id": "uuid",
  "child_id": "uuid",
  "page": 2,                              // checkpoint del cuento donde aparece
  "narrative_context": "Tomás encuentra a su amigo el conejo atascado en el barro, pero el tobogán que tanto quería probar está libre justo ahora.",
  "prompt": "¿Qué hace Tomás?",          // lo que ve/oye el niño

  // --- pieza psicológica (las 4 de §0) ---
  "primary_dimension": "empatia",         // ∈ taxonomía
  "subaxis": "reaccion_al_conflicto",     // ∈ taxonomía
  "framework_refs": {                     // trazabilidad teórica (psicologia.md)
    "casel": "social_awareness",
    "ma_stage": 2,                        // calibrado a la edad del niño
    "erikson": "industry_vs_inferiority"
  },

  "options": [
    { "id": "A", "text": "Ayuda al conejo a salir y luego van juntos al tobogán",
      "pole": "prosocial_asertivo" },
    { "id": "B", "text": "Se hace el que no vio y corre al tobogán",
      "pole": "pasivo_evitativo" },
    { "id": "C", "text": "Se enoja con el conejo por estorbar y lo deja ahí",
      "pole": "reactivo_agresivo" }
  ],

  // --- metadatos de calibración y trazabilidad ---
  "age_at_presentation": 7.3,             // edad EXACTA en años (no rango)
  "developmental_stage": "ma_stage_2",    // derivado de la edad
  "excluded_topics_respected": ["duelo_mascota"],  // qué vetó la lista de exclusión
  "generator_agent": "dilemas_v1",        // versión del prompt que lo generó (auditoría)
  "created_at": "2026-06-20T14:03:00Z"
}
```

**Reglas de validación del Contrato A** (el backend las verifica antes de mostrar el dilema):
- `primary_dimension`, `subaxis` y todos los `pole` ∈ taxonomía (§1).
- Cada `option.pole` pertenece al set de polos de esa `dimension`.
- **Cobertura de polos:** las opciones deben cubrir polos *distintos* (no dos opciones al mismo polo;
  si la dimensión tiene 3 polos, idealmente las 3 opciones cubren los 3).
- `age_at_presentation` presente y numérico; `developmental_stage` coherente con la edad.
- Ningún `excluded_topic` del perfil aparece como eje del dilema.

---

## 3. Contrato B — Decisión registrada (cuando el niño responde)

Cuando el niño elige una opción, **NO se llama a ningún LLM**. Se hace un *lookup*: se copia el polo
ya pre-registrado de la opción elegida. Esto es lo que se persiste en **Firestore** (client-side).

```jsonc
{
  "decision_id": "uuid",
  "dilemma_id": "uuid",                   // FK al Contrato A
  "child_id": "uuid",
  "story_id": "uuid",

  "chosen_option_id": "B",
  "dimension": "empatia",                 // copiado del dilema (desnormalizado para query rápida)
  "subaxis": "reaccion_al_conflicto",
  "pole": "pasivo_evitativo",             // ← LOOKUP del option.pole, no interpretación

  "age_at_decision": 7.3,                 // metadato de normalización
  "developmental_stage": "ma_stage_2",
  "response_latency_ms": 1800,            // opcional: señal débil de duda/impulsividad
  "timestamp": "2026-06-20T14:05:12Z"
}
```

> `dimension`/`subaxis`/`pole` se copian (desnormalizan) del Contrato A a propósito: el Dashboard
> consulta directo, sin joins ni texto, para pintar gráficas.
>
> **Implementación real (Firestore):** este contrato se persiste en la colección `decisions` con
> nombres en camelCase y ligado al usuario (`userId`, `childName` en vez de `child_id`). La forma
> exacta está en §6.

---

## 4. Contrato C — Agregado para el Dashboard (lo que se pinta)

El Dashboard **nunca procesa texto libre**: solo cuenta polos por dimensión a lo largo del tiempo,
aplicando los umbrales de `psicologia.md §3`. Forma de la respuesta que la API de agregación entrega
al front:

```jsonc
{
  "child_id": "uuid",
  "age_band": "6-9",                      // banda normativa (Ma stage 2) para contextualizar
  "dimensions": [
    {
      "dimension": "empatia",
      "subaxis": "reaccion_al_conflicto",
      "sample_size": 8,                   // n de decisiones en esta dimensión
      "meets_min_threshold": true,        // ≥5-8 (psicologia.md). Si false, NO se afirma tendencia
      "distribution": {                   // conteo por polo
        "prosocial_asertivo": 1,
        "pasivo_evitativo": 6,
        "reactivo_agresivo": 1
      },
      "dominant_pole": "pasivo_evitativo",
      "trend_window": "ultimos_8_cuentos",
      "alert_level": "watch",             // none | watch | elevated — derivado de umbrales, NO de una decisión
      "neutral_summary": "En 6 de 8 situaciones de conflicto eligió evitar/no intervenir."
    }
  ],
  "generated_at": "2026-06-20T14:30:00Z"
}
```

**Reglas del Contrato C:**
- Si `sample_size < min_threshold` → `meets_min_threshold:false` y el front muestra "aún no hay
  suficientes datos", **nunca** una tendencia (anti falso-positivo, `psicologia.md §3`).
- `alert_level` se calcula a nivel **agregado** (persistencia + dominancia de un polo + normalización
  por edad), nunca a nivel de una opción suelta. `riesgo_cautela` **no** puede elevar alerta sola.
- `neutral_summary` describe el patrón observable; **prohibido** lenguaje clínico/diagnóstico. El
  Agente 3 (insights) parte de estos campos, no del texto del cuento.

---

## 5. Flujo de integridad (cómo encaja con la separación de motores, §2/§8)

```
Agente 1 (Narrador) ──cuento──▶ Agente 2 (Dilemas) ──Contrato A (dilema + polos pre-registrados)──▶
   el niño elige una opción ──▶ Contrato B (lookup del polo, SIN LLM) ──▶ Firestore (client-side) ──▶
   Agregación + umbrales (psicologia.md, en el cliente) ──▶ Contrato C ──▶ Dashboard / Agente 3 (solo describe)
```

- El Agente 2 **genera** la pregunta y el mapeo → distinto del paso que **registra** la respuesta
  (lookup) → distinto del Agente 3 que **agrega/describe**. Ningún componente genera el dilema y
  "descubre" el patrón a la vez.
- Toda la cadena evaluativa vive del lado del Dashboard protegido con PIN; para el niño, sigue siendo
  un cuento.

---

## 6. Esquema de persistencia (Firestore) derivado de los contratos

La persistencia es **client-side en Firebase/Firestore** (el niño/padre ya está autenticado con Google).
Ver [`consideraciones.md`](./consideraciones.md) y [`FIRESTORE_SETUP.md`](./FIRESTORE_SETUP.md).

Cada decisión es un documento en la colección **`decisions`** (Contrato B):
```
decisions/{autoId}: {
  userId, childName,
  dimension, subaxis, pole, chosenOptionId,
  ageAtDecision, developmentalStage, dilemmaId, page, responseLatencyMs, createdAt
}
```
Los **cuentos** viven en la colección `stories` (+ subcolección `pages`, imágenes/audio en Storage).

El Dashboard lee las `decisions` del usuario, **filtra por `childName`** y **agrega en el cliente** por
`(dimension, pole)` aplicando los umbrales → Contrato C. La agregación es un **port de
`backend/aggregate.py`** (spec testeada en `tests/test_aggregate.py`); no usa LLM.

> Las reglas de seguridad de Firestore garantizan que cada usuario solo lee/escribe sus propios
> documentos (`userId == auth.uid`). El "PIN" del dashboard es solo un gate local suave.
