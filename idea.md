# Idea: Perfil Emocional Infantil a través de Decisiones Narrativas

## 1. Resumen en una frase

Convertir los puntos de decisión interactivos del cuento (`interactiveQuestion`) en una fuente de
señales emocionales y morales sobre el niño, para que sus padres puedan ver patrones de
comportamiento a lo largo del tiempo y recibir orientación hacia ayuda profesional cuando
corresponda — nunca un diagnóstico.

## 2. Cómo conecta con el MVP (Nano Banana 2.0)

El system prompt del MVP ya genera `interactiveQuestion` en los checkpoints (Pág. 2, y según el
largo del cuento, Pág. 3 o 4) y recibe `childAnswer` para ramificar la historia. Este feature **no
reemplaza ese motor**, lo extiende en dos puntos:

1. **Antes de generar el dilema:** el dilema interactivo ya no puede ser arbitrario ("¿sigue el
   camino de flores o salta al río de mermelada?"). Debe construirse a partir de una **taxonomía de
   dimensiones psicológicas** (ver sección 4) y del **perfil del niño** (cuestionario de los
   padres), para que la situación presentada efectivamente provoque una decisión emocional, ética
   o moral relevante — no solo una bifurcación estética de la trama.
2. **Después de recibir `childAnswer`:** además de usar la respuesta para continuar la historia
   (como ya hace el motor), se ejecuta una **clasificación separada** de esa respuesta contra las
   dimensiones de la taxonomía. Este paso se guarda como dato estructurado (no narrativo) asociado
   al niño, la historia y el timestamp.

Es clave que el paso de clasificación sea un proceso **independiente** del paso de continuación
narrativa. Si el mismo prompt que decide "qué dilema mostrar según el perfil del niño" es el que
también "interpreta si la respuesta es preocupante", el sistema puede caer en un ciclo de
confirmación: genera dilemas que calzan con el perfil y luego "descubre" patrones que el mismo
sistema sembró. Mantenerlos separados (incluso con modelos/prompts distintos) es un requisito de
integridad del feature, no un detalle de implementación.

## 3. Mecanismo: Cuestionario inicial de los padres

Antes de que el niño tenga su primer cuento, los padres completan un cuestionario sobre:

- Edad, intereses, personajes/temas favoritos (esto ya sirve para personalizar el tono y estética,
  alineado con la Sección 4 del MVP).
- Temperamento general (ej. tímido/extrovertido, sensible a separación, miedo a la oscuridad,
  reactividad a conflictos).
- Eventos de vida recientes relevantes (mudanza, nacimiento de hermano, pérdida de mascota o
  familiar, cambio de colegio, divorcio) — esto no solo personaliza, también sirve como **lista de
  exclusión**: temas que el generador de dilemas debe evitar activar sin cuidado clínico (ej. no
  generar un dilema sobre "perder a alguien querido" la semana de un duelo real).
- Gustos/actividades (para el tono narrativo, ya cubierto por el MVP).

Este cuestionario alimenta dos cosas distintas: (a) personalización estética/temática del cuento
(ya contemplada en el MVP), y (b) selección de qué dimensiones psicológicas priorizar y cuáles
evitar para ese niño en particular.

## 4. Mecanismo: Taxonomía de dimensiones del dilema

Cada `interactiveQuestion` debe estar etiquetada con al menos una dimensión, no ser un dilema
genérico. Dimensiones propuestas (a validar con la investigación de la Sección 7):

- **Regulación emocional** (frustración, miedo, calma ante lo desconocido)
- **Confianza / apego** (acercarse o desconfiar de un extraño, pedir ayuda vs. resolver solo)
- **Honestidad / integridad** (decir la verdad cuando es incómodo, asumir un error)
- **Empatía / agresión** (cómo trata a otro personaje en conflicto, reacción ante el daño a otro)
- **Autonomía / dependencia** (decidir solo vs. buscar guía de una figura adulta del cuento)
- **Riesgo / cautela** (explorar lo desconocido vs. quedarse en lo seguro)

Cada opción de respuesta dentro de un dilema debe poder mapearse a un polo de su dimensión. Esto
convierte el "elige tu propia aventura" en un instrumento de señal, sin que el niño note que está
siendo "evaluado" — sigue siendo, desde su perspectiva, un cuento.

## 5. Mecanismo: Dashboard de padres (protegido con clave)

- **Acceso restringido:** el dashboard es solo para los padres y se accede con **clave/PIN** — el
  niño nunca lo ve. Toda la dimensión "evaluativa" del producto vive aquí, separada de la
  experiencia del cuento.
- Visualización de **tendencias a través de múltiples cuentos**, no de una sola decisión. Una
  elección aislada no significa nada; el valor está en el patrón sostenido en el tiempo.
- Cada dimensión muestra una tendencia (ej. "en los últimos 8 cuentos, tu hijo elige evitar el
  conflicto en 7 de 8 situaciones que lo presentan") con un indicador de **cuántos datos hay
  detrás** (para no sonar certero con una sola muestra).
- Sin lenguaje clínico ni etiquetas de diagnóstico. El dashboard describe patrones observables, no
  interpreta causas.

## 6. Mecanismo: Agente de insights (chat para padres, dentro del dashboard)

- Responde preguntas de los padres sobre lo que el dashboard muestra ("¿qué significa que mi hija
  elija casi siempre quedarse callada?").
- **Regla dura: nunca da diagnóstico ni recomendación psicológica.** Solo describe el patrón
  observado en términos neutros y, cuando el patrón es sostenido o entra en una categoría de
  alerta, recomienda **consultar a un profesional** (psicólogo infantil, pediatra) — idealmente con
  un directorio o canal de derivación, no solo el consejo de "habla con alguien".
- **Sin avisos push ni escalamiento externo.** Toda señal de alerta (incluidas las de categoría
  alta) **se muestra únicamente dentro del dashboard protegido**, no como notificación inmediata
  fuera de él. El escalamiento se expresa como prioridad/visibilidad dentro del panel y una
  recomendación clara de consultar a un profesional, no como un canal de aviso aparte.

## 7. Fundamento teórico (✅ investigado — ver `psicologia.md`)

La premisa central — que las decisiones de un niño dentro de una narrativa revelan estados
emocionales internos — está respaldada por literatura clínica (tests proyectivos narrativos,
storytelling terapéutico). La investigación completa, citable, vive en [`psicologia.md`](./psicologia.md).
Conclusiones que aterrizan en este diseño:

- **Validez:** las técnicas proyectivas narrativas sirven como **suplemento**, nunca como
  diagnóstico (Santillo et al., 2025). No hay validación de versiones digitales sin terapeuta → el
  copy debe ser humilde, hablar de "patrones para conversar con un profesional", no de screening.
- **Marco de dimensiones:** **CASEL** (columna) + **Ma 2013** (calibración moral por edad) +
  **Erikson** (lente evolutiva). Kohlberg descartado como base. Esto ancla la taxonomía de la
  Sección 4 a teoría reconocida (guardrail §8).
- **Umbrales (anti falso-positivo):** una decisión nunca cuenta; se requiere **persistencia +
  impairment + rareza respecto a la norma de su edad** (Cooper, 2013). Piso de muestra ≥5–8
  observaciones por dimensión antes de hablar de tendencia, y normalizar por **edad exacta**.

## 8. Guardrails no negociables

- El producto **nunca diagnostica**. Solo describe patrones y deriva a profesionales.
- El producto **nunca da consejo psicológico** a los padres ni al niño.
- Las dimensiones y umbrales deben estar **respaldados por literatura citable**, no ser heurísticas
  inventadas por el equipo.
- Separación entre el motor que personaliza/genera el dilema y el motor que clasifica la respuesta,
  para evitar sesgo circular.
- El niño no debe sentir que está siendo evaluado — la experiencia debe seguir siendo, en todo
  momento, un cuento.

## 9. Stack técnico

| Capa | Tecnología | Rol |
|---|---|---|
| Backend / agentes | **Python + Google ADK** (vía `agents-cli`) | Define el sistema multiagéntico y expone los **endpoints** (`adk api_server`, FastAPI) que consume el front. Playground en `:8080` para desarrollo. |
| Frontend | **Estático (HTML/CSS/JS)** servido por FastAPI | Configuración de padres, creación del cuento, lector interactivo, dashboard. (Migrable a Next.js.) |
| Texto-a-voz | **ElevenLabs** | TTS: el niño puede tocar para que el cuento se lea en voz alta. |
| Imágenes | **"Nano Banana 2.0"** (Gemini) | Ilustraciones del cuento. |
| Auth + Persistencia | **Firebase (Auth + Firestore)** — client-side | Login con Google; cuentos (`stories`) y decisiones (`decisions`) por usuario. El dashboard agrega en el cliente. Ver [`FIRESTORE_SETUP.md`](./FIRESTORE_SETUP.md) y [`consideraciones.md`](./consideraciones.md). |
| Acceso al dashboard | **Sesión de Google** (+ PIN local suave) | Cada usuario ve solo sus datos (Security Rules de Firestore); el niño nunca lo ve. |

## 10. Arquitectura de agentes

Tres agentes con prompts/contextos separados (la separación es requisito de integridad, §8):

1. **Agente 1 — Narrador.** Genera el cuento adhoc a los gustos del niño. Su system prompt recibe
   como **contexto dinámico**: el perfil del niño (edad, sexo, gustos — editable) y los "recuerdos /
   eventos recientes" que ingresan los padres (ej. "hoy se peleó por un juguete"). Si el padre
   cambia algo, cambia el contexto y cambia el cuento. Los eventos recientes también alimentan la
   **lista de exclusión** (§3): temas a evitar.
2. **Agente 2 — Dilemas.** Recibe como input **el cuento del Agente 1** e inserta las preguntas de
   decisión que calcen con la historia, según la lógica de `psicologia.md` (dimensiones CASEL+Ma+
   Erikson, calibración por edad). **Requisito de integridad:** emite, junto a cada pregunta, la
   **dimensión y el polo al que mapea cada opción de respuesta** (mapeo *pre-registrado*, antes de
   que el niño responda). Así, clasificar la respuesta del niño es un *lookup* —a qué polo apuntó—,
   no una interpretación creativa post-hoc.
3. **Agente 3 — Copiloto de insights (Fase 2).** Vive dentro del dashboard protegido. **Agrega**
   las decisiones ya clasificadas a lo largo del tiempo, describe patrones en lenguaje neutro,
   responde preguntas de los padres y deriva a profesional. No reinterpreta cada respuesta
   individual (eso ya está pre-registrado por el Agente 2): solo agrega y describe. Respeta los
   umbrales de `psicologia.md` (piso de muestra, normalización por edad) y muestra alertas **solo
   dentro del dashboard**, sin avisos externos (§6).

## 11. Estrategia de desarrollo: iterativa, un agente a la vez

No construimos todo a la vez ni empezamos por la interfaz. **Validamos un agente a la vez en
entornos aislados** (vía `adk run` / playground, sin front), y la **interfaz es el último paso**.
El foco es: (a) que cada agente entregue exactamente la estructura que el siguiente necesita, y
(b) que el **esquema lógico-psicológico** (el contrato de datos pre-registrado) sea sólido antes de
pintar nada.

- **Paso 1 — Agente 1 (Narrador), aislado.** Genera el cuento según perfil del niño + "recuerdos /
  eventos recientes" de los padres (usados como **lista de exclusión** para no activar traumas). Se
  testea solo, contra una rúbrica, antes de seguir. → Plan de pruebas en
  [`pruebas-agente1.md`](./pruebas-agente1.md).
- **Paso 2 — Agente 2 (Dilemas), aislado.** Lee el cuento del Agente 1 e inserta dilemas calibrados
  por edad. Su salida es el **contrato de datos pre-registrado**: dimensión, sub-eje y el mapeo de
  cada opción a un polo conductual, *antes* de que el niño responda. → Contrato en
  [`esquema-datos.md`](./esquema-datos.md).
- **Paso 3 — Esquema de datos + persistencia + Agente 3 (Insights) + Dashboard.** Se persisten las
  decisiones (lookup del polo elegido, sin reinterpretar texto), se agregan con los umbrales de
  `psicologia.md`, y el Agente 3 describe patrones en el dashboard protegido con PIN.
- **Paso 4 (final) — Frontend (Next.js).** Recién aquí se integra todo en la experiencia jugable:
  onboarding de padres, lector del niño con TTS (ElevenLabs) y el dashboard.

> El **esquema lógico-psicológico de datos** (lo que el Agente 2 emite y lo que el Dashboard espera,
> sin procesar texto libre) es el puente central del feature y vive en
> [`esquema-datos.md`](./esquema-datos.md). El plan de desarrollo operativo (carpetas ADK, endpoints,
> dependencias, hitos) está en [`plan-desarrollo.md`](./plan-desarrollo.md).
