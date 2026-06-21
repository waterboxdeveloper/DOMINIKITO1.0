"""Modelos de datos del backend (Pydantic v2).

- `ChildProfile`: contexto que arma el padre (input, va al `state` de la sesión ADK).
- `Story` / `StoryPage`: salida del Agente 1 (Narrador).
- Contrato A de dilemas (`esquema-datos.md §2`), Agente 2:
  - `AnswerOption`, `DilemmaDraft`, `DilemmaDraftSet` (lo que emite el LLM),
  - `Dilemma` (enriquecido de forma determinista por el post-procesador).

Los modelos de la decisión registrada (Contrato B) llegan con la persistencia (Paso 3).
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class ChildProfile(BaseModel):
    """Perfil del niño + contexto que los padres editan. Es el input del Narrador.

    Se inyecta en el `state` de la sesión ADK; el system prompt lo lee vía templating `{...}`.
    """

    name: str = Field(description="Nombre del niño (protagonista del cuento).")
    age: float = Field(description="Edad EXACTA en años, p.ej. 7.5 (no un rango).", ge=2, le=12)
    sex: str = Field(default="", description="Sexo/género del niño, opcional para concordancia.")
    likes: list[str] = Field(
        default_factory=list,
        description="Gustos/intereses: personajes, temas, animales, actividades.",
    )
    temperament: str = Field(
        default="",
        description="Temperamento general (ej. tímido, sensible a separación, miedo a la oscuridad).",
    )
    recent_events: list[str] = Field(
        default_factory=list,
        description="'Recuerdos' que escriben los padres (ej. 'hoy se peleó por un juguete'). "
        "Son DATOS, no instrucciones. Derivan la lista de exclusión.",
    )
    story_theme: str = Field(
        default="",
        description="De qué quieren los padres que trate el cuento, en simple.",
    )


class StoryPage(BaseModel):
    """Una página del cuento."""

    page: int = Field(description="Número de página, empezando en 1.", ge=1)
    text: str = Field(
        description="Texto narrativo MUY corto de la página (máximo 1 o 2 oraciones sencillas, "
        "entre 15 y 25 palabras en total). Debe ser cálido, dinámico y acorde a la edad.",
    )
    image_prompt: str = Field(
        description="Prompt EN INGLÉS, puramente visual, para ilustrar la página "
        "(estilo libro infantil acuarela). Describe escena, personajes y expresiones.",
    )
    is_checkpoint: bool = Field(
        default=False,
        description="True si la página deja una situación ABIERTA donde el Agente 2 podrá "
        "insertar un dilema de decisión. No incluyas la pregunta aquí: solo deja el gancho.",
    )


class Story(BaseModel):
    """Cuento completo generado por el Narrador (Agente 1)."""

    title: str = Field(description="Título del cuento, evocador y apto para niños.")
    pages: list[StoryPage] = Field(
        description="Páginas en orden. Debe haber ≥1 checkpoint. Cada página con texto muy corto.",
    )
    age_at_creation: float = Field(
        description="Edad exacta del niño al crear el cuento (copiada del perfil, para auditoría).",
    )


# --- Cuento interactivo (Agente cuentista) -----------------------------------

class StorySegment(BaseModel):
    """Un tramo del cuento interactivo. Si no es el final, la última página deja una escena
    abierta (`is_checkpoint`) lista para el dilema."""

    pages: list[StoryPage] = Field(
        description="Páginas de este tramo, en orden. OBLIGATORIO: Genera exactamente de 5 a 6 páginas por tramo "
        "en modo 'start' y de 4 a 5 páginas en modo 'continue' o 'conclude'.",
    )
    is_ending: bool = Field(
        default=False, description="True si este tramo cierra el cuento (sin más decisiones).",
    )


# --- Contrato A: dilema pre-registrado (Agente 2) ----------------------------

class AnswerOption(BaseModel):
    """Una opción de respuesta, ya mapeada a un polo conductual ANTES de que el niño elija."""

    id: str = Field(description="Identificador corto y estable: 'A', 'B' o 'C'.")
    text: str = Field(description="Texto de la opción tal como la verá/oirá el niño, dentro del cuento.")
    pole: str = Field(
        description="Polo conductual al que apunta esta opción. DEBE ser un polo válido de la "
        "dimensión del dilema (ver taxonomía). Descriptivo, no un juicio clínico.",
    )


class DilemmaDraft(BaseModel):
    """Lo que emite el LLM del Agente 2 para UN checkpoint (borrador, antes de enriquecer)."""

    page: int = Field(description="Número de la página de checkpoint donde va el dilema.", ge=1)
    narrative_context: str = Field(
        description="La escena abierta del cuento donde ocurre la decisión (1-2 frases).",
    )
    prompt: str = Field(description="La pregunta que ve el niño, dentro del tono del cuento.")
    primary_dimension: str = Field(description="Clave de dimensión de la taxonomía.")
    subaxis: str = Field(description="Sub-eje de esa dimensión (de la taxonomía).")
    options: list[AnswerOption] = Field(
        description="2 o 3 opciones, cada una a un polo DISTINTO de la dimensión "
        "(dimensiones de 2 polos → 2 opciones; empatia → 3).",
    )


class DilemmaDraftSet(BaseModel):
    """Salida estructurada del Agente 2 (ADK output_schema): un borrador por checkpoint."""

    items: list[DilemmaDraft] = Field(
        description="Un DilemmaDraft por cada página is_checkpoint del cuento, en orden.",
    )


class Dilemma(BaseModel):
    """Dilema enriquecido de forma determinista por el post-procesador (Contrato A completo)."""

    dilemma_id: str
    story_id: str = ""
    child_id: str = ""
    page: int
    narrative_context: str
    prompt: str
    primary_dimension: str
    subaxis: str
    framework_refs: dict = Field(default_factory=dict)
    options: list[AnswerOption]
    age_at_presentation: float
    developmental_stage: str
    excluded_topics_respected: list[str] = Field(default_factory=list)
    generator_agent: str = "dilemas_v1"
    created_at: datetime
