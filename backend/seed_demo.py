"""Siembra decisiones falsas de un niño demo para ver el dashboard SIN gastar API/créditos.

Requiere SUPABASE configurado en backend/.env. Uso:
    backend/.venv/bin/python seed_demo.py
"""

from __future__ import annotations

import sys
from pathlib import Path

from dotenv import load_dotenv

BACKEND = Path(__file__).resolve().parent
sys.path.insert(0, str(BACKEND))
load_dotenv(BACKEND / ".env")

import db  # noqa: E402
from development import ma_stage  # noqa: E402

# Patrón demo: empatía con tendencia clara a "observar sin intervenir"; confianza sana;
# regulación con pocos datos (cae bajo el umbral → "aún no hay suficientes datos").
PLAN = [
    ("empatia", "reaccion_al_conflicto",
     ["pasivo_evitativo"] * 6 + ["prosocial_asertivo", "reactivo_agresivo"]),   # n=8 → elevated
    ("confianza_apego", "apego",
     ["busca_vinculo"] * 5 + ["evita_desconfia"] * 2),                          # n=7
    ("autonomia", "decidir_solo_vs_guia",
     ["autonomo"] * 4 + ["dependiente"] * 3),                                   # n=7
    ("regulacion_emocional", "frustracion",
     ["regulado"] * 3 + ["desregulado"]),                                       # n=4 → bajo umbral
]


def main() -> None:
    if not db.enabled():
        print("⚠️ Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en backend/.env")
        return
    child_id = db.upsert_child("Demo Dominik", 7.0, "")
    story_id = db.create_story(child_id, "siembra demo")
    n = 0
    for dim, sub, poles in PLAN:
        for pole in poles:
            db.save_decision({
                "child_id": child_id, "story_id": story_id,
                "dimension": dim, "subaxis": sub, "pole": pole,
                "age_at_decision": 7.0, "developmental_stage": ma_stage(7.0),
            })
            n += 1
    print(f"✅ Sembradas {n} decisiones para 'Demo Dominik' (child_id={child_id}). "
          f"Abre el dashboard con tu PIN y elige a 'Demo Dominik'.")


if __name__ == "__main__":
    main()
