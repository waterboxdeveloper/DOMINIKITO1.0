# Consideraciones — Persistencia client-side vs server-side

> Registro de decisión (ADR). Documenta el trade-off de mover la lógica del perfil emocional
> (decisiones + dashboard) a **Firestore client-side**, qué riesgos implica, qué elegimos y por qué.
> Relacionado: [`psicologia.md`](./psicologia.md) (umbrales), [`esquema-datos.md`](./esquema-datos.md),
> [`idea.md`](./idea.md) §8 (guardrails).

## 1. El contexto

El "perfil emocional" se construye agregando las decisiones del niño con **reglas de `psicologia.md`**:
- No mostrar una tendencia hasta tener **mínimo 5 decisiones** (`MIN_SAMPLE = 5`).
- Alertar solo cuando un polo **domina** (watch ≥ 0.70 / elevated ≥ 0.85).
- El eje **`riesgo_cautela` nunca dispara una alerta** por sí solo.
- **Nunca diagnosticar**: solo describir patrones en lenguaje neutro.

La pregunta es **dónde corre esa lógica**:
- **Server-side (backend Python):** el navegador no la ve ni la puede tocar; solo recibe el resultado.
- **Client-side (JavaScript en el navegador):** cualquiera puede abrir las DevTools (F12), **leerla y
  modificarla**, y/o escribir directo en la base de datos.

## 2. Qué elegimos

**Client-side (Firestore desde el navegador).** Las decisiones se guardan en Firestore y el dashboard
agrega en JavaScript, igual que ya se guardan los cuentos.

## 3. Qué podría pasar al usar client-side (los riesgos)

### 3.1 Manipulación de los umbrales — el riesgo más importante
La lógica de umbrales vive en el JS del navegador. Alguien con conocimiento técnico podría **cambiar
el umbral** y romper el guardrail anti–falso-positivo.

**Ejemplo concreto:** si alguien cambia `MIN_SAMPLE = 5` a `MIN_SAMPLE = 1` en la consola, el dashboard
mostraría una **"tendencia"** o incluso una **alerta** con **una sola decisión**. Eso es exactamente lo
que `psicologia.md` nos dice que evitemos: un **falso positivo** que genera **ansiedad innecesaria en
los padres** ("tu hijo tiene un patrón de X") cuando en realidad no hay datos suficientes. El daño no
es técnico, es **humano**: angustiar a una familia con una señal que no es real.

De forma similar, alguien podría:
- Hacer que `riesgo_cautela` **sí** dispare alertas (cuando no debe).
- Alterar el **lenguaje neutro** y convertirlo en algo que **suene a diagnóstico**.
- Cambiar la dominancia (0.70/0.85) para inflar o esconder alertas.

### 3.2 Inyección de datos falsos
Al escribir desde el cliente, alguien podría **insertar decisiones falsas** directo en Firestore
(p. ej. 8 decisiones "pasivo_evitativo" que nunca ocurrieron) y fabricar un patrón inexistente.

### 3.3 Privacidad depende de las reglas de Firestore
La separación "cada padre solo ve a su hijo" ya **no** la garantiza el servidor: depende de las
**Security Rules de Firestore** (que un usuario solo lea/escriba documentos con su propio `userId`).
Si esas reglas están mal configuradas, un usuario podría ver datos de otro.

### 3.4 La lógica clínica queda expuesta
Todos los umbrales y etiquetas quedan **visibles** en el código del navegador.

## 4. Por qué lo elegimos igual (la justificación)

1. **Es un hackathon, no producción.** El riesgo es **teórico/de producto real**, no de un demo:
   nadie va a abrir la consola y manipular umbrales durante la presentación.
2. **Consistencia y velocidad.** Los cuentos ya se guardan client-side en Firestore; mover las
   decisiones ahí unifica todo en un solo lugar, sin montar un service account ni Admin SDK en el
   backend. Menos piezas, menos cosas que fallen el día del demo.
3. **El valor a demostrar es la experiencia + el rigor del marco** (CASEL/Ma/Erikson y los umbrales),
   no la infraestructura anti-manipulación.

## 5. Cómo mitigamos el riesgo (lo que SÍ hacemos)

- **Spec testeada en Python como fuente de verdad.** Mantenemos `aggregate.py` (`aggregate_decisions`)
  + `tests/test_aggregate.py` con los umbrales exactos. El JS del cliente **debe coincidir** con ese
  spec; el test documenta y blinda la regla aunque no corra en producción.
- **Security Rules de Firestore por usuario** (`userId == request.auth.uid`) para read/write de la
  colección `decisions`.
- **Comentario explícito en el código** señalando que esta lógica, en producción, debe vivir en el
  servidor.

## 6. Qué haríamos en producción (la ruta correcta)

Mover la agregación y la escritura validada al **servidor**: Cloud Functions o backend con
**firebase-admin** (Admin SDK). Así:
- Los umbrales corren donde el usuario no los puede tocar.
- El servidor **valida** cada escritura de decisión (que venga del flujo real, no inyectada).
- El "nunca diagnostica" queda **garantizado** centralmente.

(Es la opción "B" que evaluamos; queda como deuda técnica consciente para post-hackathon.)

## 7. Decisión

**Vamos con client-side (Firestore en el navegador)** para el hackathon, con las mitigaciones de §5,
y dejando registrada la deuda técnica de §6 para producción.

— Decidido el 2026-06-20.
