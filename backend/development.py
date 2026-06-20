"""Mapeo edad → estadio de desarrollo (determinista), anclado a `psicologia.md §2`.

Lo usa el post-procesador del Agente 2 para rellenar `developmental_stage` sin dejarlo al criterio
del LLM, y el system prompt para calibrar la dificultad moral del dilema.

Ma (2013), modelo moral integrado:
- Estadio 1 (≈3–6): supervivencia, egocentrismo, obediencia. El egoísmo es NORMAL aquí.
- Estadio 2 (≈6–9): afecto, altruismo recíproco.
- Estadio 3 (≈9–12): pertenencia, altruismo de grupo primario.
"""

from __future__ import annotations


def ma_stage(age: float) -> str:
    """Devuelve 'ma_stage_1' | 'ma_stage_2' | 'ma_stage_3' según la edad exacta."""
    if age < 6:
        return "ma_stage_1"
    if age < 9:
        return "ma_stage_2"
    return "ma_stage_3"


def erikson_stage(age: float) -> str:
    """Estadio psicosocial de Erikson relevante para 3–12 años."""
    if age < 6:
        return "initiative_vs_guilt"
    return "industry_vs_inferiority"


def stage_guidance(age: float) -> str:
    """Frase de calibración para inyectar en el prompt del Agente 2."""
    stage = ma_stage(age)
    return {
        "ma_stage_1": "Estadio Ma 1 (3-6): el egocentrismo es normal; dilemas simples y concretos, "
        "sin exigir razonamiento moral complejo.",
        "ma_stage_2": "Estadio Ma 2 (6-9): nociones de reciprocidad y amistad; dilemas con un poco "
        "más de matiz social.",
        "ma_stage_3": "Estadio Ma 3 (9-12): pertenencia a un grupo; dilemas con más matices y "
        "consecuencias sociales.",
    }[stage]


def stage_label(age: float) -> str:
    """Etiqueta corta del estadio (para el dashboard)."""
    return {
        "ma_stage_1": "Etapa exploradora (3-6 años)",
        "ma_stage_2": "Etapa de amistad y reciprocidad (6-9 años)",
        "ma_stage_3": "Etapa de pertenencia (9-12 años)",
    }[ma_stage(age)]


def stage_note(age: float) -> str:
    """Nota para padres sobre qué es esperable a esta edad (anclado a Ma 2013 + Erikson)."""
    return {
        "ma_stage_1": "A esta edad es totalmente normal que el egocentrismo guíe muchas decisiones "
        "(Ma, etapa 1; Erikson: iniciativa vs. culpa). Lo que ves es desarrollo típico, no un problema.",
        "ma_stage_2": "A esta edad empiezan la reciprocidad y la amistad ('te ayudo si me ayudas') "
        "(Ma, etapa 2; Erikson: industria vs. inferioridad). Las tendencias se leen con esta lente.",
        "ma_stage_3": "A esta edad pesa la pertenencia al grupo y la lealtad a los amigos "
        "(Ma, etapa 3). Es el marco para interpretar lo que eligió.",
    }[ma_stage(age)]
