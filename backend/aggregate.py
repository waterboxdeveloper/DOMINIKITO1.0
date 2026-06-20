"""Agregación para el dashboard (Contrato C de esquema-datos.md §4).

Cuenta polos por dimensión a lo largo del tiempo y aplica los umbrales de `psicologia.md §3`. NO usa
LLM ni procesa texto libre: solo datos de la tabla `decisions`. Lenguaje neutro, sin diagnóstico.
"""

from __future__ import annotations

from datetime import datetime, timezone

import taxonomy as tax
from db import get_decisions
from development import ma_stage

MIN_SAMPLE = 5          # piso de muestra (psicologia.md §3); por debajo NO se afirma tendencia
WATCH_SHARE = 0.70      # dominancia de un polo → "watch"
ELEVATED_SHARE = 0.85   # dominancia alta → "elevated"

_AGE_BAND = {"ma_stage_1": "3-6", "ma_stage_2": "6-9", "ma_stage_3": "9-12"}

_DIM_LABEL = {
    "regulacion_emocional": "regulación emocional",
    "confianza_apego": "confianza y cercanía",
    "honestidad": "honestidad",
    "empatia": "empatía",
    "autonomia": "autonomía",
    "riesgo_cautela": "exploración",
}

# Etiquetas NEUTRAS de cada polo (descriptivas, sin juicio clínico).
_POLE_LABEL = {
    "regulado": "mantener la calma",
    "desregulado": "reaccionar con intensidad",
    "busca_vinculo": "acercarse o pedir ayuda",
    "evita_desconfia": "resolver solo o mantener distancia",
    "asume_transparente": "decir la verdad o asumir",
    "evade_oculta": "evitar o callar",
    "prosocial_asertivo": "ayudar o intervenir",
    "pasivo_evitativo": "observar sin intervenir",
    "reactivo_agresivo": "reaccionar con enojo",
    "autonomo": "decidir por sí mismo",
    "dependiente": "buscar la guía de un adulto",
    "explorador": "explorar lo nuevo",
    "cauto": "quedarse en lo seguro",
}


def _summary(dim: str, dominant: str | None, count: int, n: int, meets: bool) -> str:
    if not meets:
        return f"Aún no hay suficientes datos en {_DIM_LABEL.get(dim, dim)} ({n}). " \
               f"Hacen falta al menos {MIN_SAMPLE} para hablar de un patrón."
    return f"En {count} de {n} situaciones de {_DIM_LABEL.get(dim, dim)}, " \
           f"tu peque eligió {_POLE_LABEL.get(dominant, dominant)}."


def aggregate_decisions(decisions: list[dict]) -> dict:
    """Función pura (testeable sin BD): lista de decisiones → Contrato C parcial (dimensions + age_band)."""
    by_dim: dict[str, list[dict]] = {}
    latest_age: float | None = None
    for d in decisions:
        dim = d.get("dimension")
        if dim not in tax.DIMENSIONS:
            continue
        by_dim.setdefault(dim, []).append(d)
        if d.get("age_at_decision") is not None:
            latest_age = float(d["age_at_decision"])

    dimensions = []
    for dim, rows in by_dim.items():
        distribution = {p: 0 for p in tax.poles_for(dim)}
        subaxis = None
        for r in rows:
            p = r.get("pole")
            if p in distribution:
                distribution[p] += 1
            subaxis = subaxis or r.get("subaxis")
        n = sum(distribution.values())
        dominant = max(distribution, key=distribution.get) if n else None
        share = (distribution[dominant] / n) if (n and dominant) else 0.0
        meets = n >= MIN_SAMPLE
        alert = "none"
        if meets and not tax.is_secondary(dim):
            if share >= ELEVATED_SHARE:
                alert = "elevated"
            elif share >= WATCH_SHARE:
                alert = "watch"
        dimensions.append({
            "dimension": dim,
            "label": _DIM_LABEL.get(dim, dim),
            "subaxis": subaxis,
            "sample_size": n,
            "meets_min_threshold": meets,
            "distribution": distribution,
            "dominant_pole": dominant,
            "alert_level": alert,
            "secondary": tax.is_secondary(dim),
            "neutral_summary": _summary(dim, dominant, distribution.get(dominant, 0) if dominant else 0, n, meets),
        })

    return {
        "age_band": _AGE_BAND.get(ma_stage(latest_age), "") if latest_age is not None else "",
        "dimensions": dimensions,
    }


def build_dashboard(child_id: str) -> dict:
    """Contrato C completo para un niño (lee de la BD)."""
    agg = aggregate_decisions(get_decisions(child_id))
    return {
        "child_id": child_id,
        "age_band": agg["age_band"],
        "dimensions": agg["dimensions"],
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
