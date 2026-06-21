"""Orquestación del cuento interactivo por tramos (ramificado según las decisiones del niño).

Encadena el agente 'cuentista' (genera el tramo) con el Agente 2 (Dilemas, intacto) que añade el
dilema con su mapeo pre-registrado. `start_story` abre el cuento; `next_story` continúa o concluye
según la elección y cuántas decisiones se llevan.
"""

from __future__ import annotations

import asyncio

from google.adk.runners import InMemoryRunner
from google.genai import types

from agents.cuentista import root_agent
from development import stage_guidance
from dilemas_runner import generate_dilemmas
from profile import derive_exclusion_list
from schemas import ChildProfile, Dilemma, Story, StorySegment

APP_NAME = "cuentista"
TOTAL_DECISIONS = 2


def build_state(profile: ChildProfile, mode: str) -> dict[str, str]:
    return {
        "child_name": profile.name,
        "child_age": f"{profile.age:g}",
        "child_sex": profile.sex,
        "child_likes": ", ".join(profile.likes),
        "child_temperament": profile.temperament,
        "story_theme": profile.story_theme,
        "exclusion_list": ", ".join(derive_exclusion_list(profile.recent_events)),
        "stage_guidance": stage_guidance(profile.age),
        "mode": mode,
    }


def ensure_segment_checkpoint(seg: StorySegment) -> StorySegment:
    """Si el tramo no es final y ninguna página es checkpoint, marca la última (garantía)."""
    if seg.is_ending or not seg.pages or any(p.is_checkpoint for p in seg.pages):
        return seg
    seg.pages[-1].is_checkpoint = True
    return seg


async def _agenerate_segment(
    profile: ChildProfile, mode: str, story_so_far: list[str] | None, last_choice: str | None
) -> StorySegment:
    runner = InMemoryRunner(agent=root_agent, app_name=APP_NAME)
    session = await runner.session_service.create_session(
        app_name=APP_NAME, user_id="tester", state=build_state(profile, mode)
    )
    if mode == "start":
        msg = "Empieza el cuento (modo start). REGLA CRÍTICA: Divide la historia en MUCHAS páginas (exactamente entre 5 y 6 páginas). Cada página debe tener un MÁXIMO de 1 o 2 oraciones muy cortas."
    else:
        history = "\n".join(story_so_far or [])
        msg = (f"Historia hasta ahora:\n{history}\n\n"
               f"El niño eligió: «{last_choice}»\n\nContinúa el cuento (modo {mode}). REGLA CRÍTICA: Divide la historia en varias páginas (exactamente entre 4 y 5 páginas). Cada página debe tener un MÁXIMO de 1 o 2 oraciones muy cortas.")
    final_text: str | None = None
    async for event in runner.run_async(
        user_id="tester",
        session_id=session.id,
        new_message=types.Content(role="user", parts=[types.Part(text=msg)]),
    ):
        if event.is_final_response() and event.content and event.content.parts:
            final_text = event.content.parts[0].text
    if final_text is None:
        raise RuntimeError("El cuentista no devolvió respuesta final.")
    return StorySegment.model_validate_json(final_text)


def _generate_segment(profile, mode, story_so_far=None, last_choice=None) -> StorySegment:
    return asyncio.run(_agenerate_segment(profile, mode, story_so_far, last_choice))


def _dilemma_for_segment(seg: StorySegment, profile: ChildProfile) -> Dilemma | None:
    """Reutiliza el Agente 2 (Dilemas) sobre el tramo actual (su última página es checkpoint)."""
    story = Story(title="(tramo)", pages=seg.pages, age_at_creation=profile.age)
    dilemmas, _errors = generate_dilemmas(story, profile)
    return dilemmas[0] if dilemmas else None


def start_story(profile: ChildProfile) -> dict:
    seg = ensure_segment_checkpoint(_generate_segment(profile, "start"))
    dilemma = _dilemma_for_segment(seg, profile)
    return {"segment": seg, "dilemma": dilemma, "choices_made": 0, "total": TOTAL_DECISIONS}


def next_story(profile: ChildProfile, story_so_far: list[str], choice: str, choices_made: int) -> dict:
    conclude = choices_made >= TOTAL_DECISIONS
    mode = "conclude" if conclude else "continue"
    seg = _generate_segment(profile, mode, story_so_far=story_so_far, last_choice=choice)
    if conclude or seg.is_ending:
        return {"segment": seg, "dilemma": None, "done": True, "choices_made": choices_made}
    seg = ensure_segment_checkpoint(seg)
    dilemma = _dilemma_for_segment(seg, profile)
    return {"segment": seg, "dilemma": dilemma, "done": False, "choices_made": choices_made}
