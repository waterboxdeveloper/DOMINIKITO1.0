"""Capa de persistencia (Supabase). Guarda niños, cuentos y decisiones (Contrato B).

Diseño tolerante: si NO hay credenciales (`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`), todas las
funciones son no-op y la app sigue funcionando (solo no persiste). Así el cuento y la voz funcionan
aunque aún no tengas la BD configurada.

Usa la `service_role` key (solo servidor; bypassa RLS).
"""

from __future__ import annotations

import os

_client = None

# columnas válidas de `decisions` (whitelist para el insert)
_DECISION_COLS = (
    "child_id", "story_id", "dilemma_id", "page", "dimension", "subaxis", "pole",
    "chosen_option_id", "age_at_decision", "developmental_stage", "response_latency_ms",
)


def enabled() -> bool:
    return bool(os.environ.get("SUPABASE_URL") and os.environ.get("SUPABASE_SERVICE_ROLE_KEY"))


def _client_once():
    global _client
    if _client is None:
        from supabase import create_client
        _client = create_client(
            os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"]
        )
    return _client


def upsert_child(name: str, age: float, sex: str = "") -> str | None:
    """Devuelve el child_id: busca por nombre o crea. None si no hay BD/falla."""
    if not enabled() or not name:
        return None
    try:
        c = _client_once()
        found = c.table("children").select("id").eq("name", name).limit(1).execute()
        if found.data:
            return found.data[0]["id"]
        ins = c.table("children").insert({"name": name, "age": age, "sex": sex}).execute()
        return ins.data[0]["id"]
    except Exception:  # noqa: BLE001
        return None


def create_story(child_id: str | None, theme: str = "") -> str | None:
    if not enabled() or not child_id:
        return None
    try:
        ins = _client_once().table("stories").insert({"child_id": child_id, "theme": theme}).execute()
        return ins.data[0]["id"]
    except Exception:  # noqa: BLE001
        return None


def save_decision(payload: dict) -> bool:
    """Guarda una decisión (Contrato B). Solo inserta columnas conocidas."""
    if not enabled() or not payload.get("child_id"):
        return False
    row = {k: payload.get(k) for k in _DECISION_COLS if payload.get(k) is not None}
    if not row.get("dimension") or not row.get("pole"):
        return False
    try:
        _client_once().table("decisions").insert(row).execute()
        return True
    except Exception:  # noqa: BLE001
        return False


def list_children() -> list[dict]:
    if not enabled():
        return []
    try:
        res = _client_once().table("children").select("id,name,age").order(
            "created_at", desc=True
        ).execute()
        return res.data or []
    except Exception:  # noqa: BLE001
        return []


def get_decisions(child_id: str) -> list[dict]:
    if not enabled() or not child_id:
        return []
    try:
        res = _client_once().table("decisions").select("*").eq(
            "child_id", child_id
        ).order("created_at").execute()
        return res.data or []
    except Exception:  # noqa: BLE001
        return []
