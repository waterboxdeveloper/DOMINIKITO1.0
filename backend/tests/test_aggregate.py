"""Tests deterministas del agregado del dashboard (Contrato C). Sin BD."""

from aggregate import aggregate_decisions


def _decs(dim, sub, poles, age=7.0):
    return [{"dimension": dim, "subaxis": sub, "pole": p, "age_at_decision": age} for p in poles]


def test_below_threshold_no_trend():
    agg = aggregate_decisions(_decs("empatia", "reaccion_al_conflicto", ["pasivo_evitativo"] * 3))
    d = agg["dimensions"][0]
    assert d["meets_min_threshold"] is False
    assert d["alert_level"] == "none"
    assert "suficientes" in d["neutral_summary"].lower()


def test_dominant_pole_elevates():
    agg = aggregate_decisions(_decs("empatia", "reaccion_al_conflicto",
                                    ["pasivo_evitativo"] * 7 + ["prosocial_asertivo"]))
    d = agg["dimensions"][0]
    assert d["sample_size"] == 8 and d["meets_min_threshold"]
    assert d["dominant_pole"] == "pasivo_evitativo"
    assert d["alert_level"] == "elevated"      # 7/8 = 0.875 ≥ 0.85


def test_watch_level():
    agg = aggregate_decisions(_decs("empatia", "reaccion_al_conflicto",
                                    ["pasivo_evitativo"] * 5 + ["prosocial_asertivo"] * 2))
    assert agg["dimensions"][0]["alert_level"] == "watch"   # 5/7 = 0.71


def test_riesgo_cautela_never_elevates():
    agg = aggregate_decisions(_decs("riesgo_cautela", "explorar_vs_quedarse_seguro", ["cauto"] * 8))
    d = agg["dimensions"][0]
    assert d["meets_min_threshold"] and d["dominant_pole"] == "cauto"
    assert d["alert_level"] == "none"          # secundaria no eleva alerta


def test_distribution_and_sample():
    agg = aggregate_decisions(_decs("autonomia", "decidir_solo_vs_guia",
                                    ["autonomo"] * 4 + ["dependiente"] * 3))
    d = agg["dimensions"][0]
    assert d["distribution"] == {"autonomo": 4, "dependiente": 3}
    assert d["sample_size"] == 7


def test_age_band_and_unknown_dim():
    agg = aggregate_decisions(_decs("autonomia", "decidir_solo_vs_guia", ["autonomo"], age=8.0))
    assert agg["age_band"] == "6-9"
    assert aggregate_decisions([{"dimension": "inventada", "pole": "x"}])["dimensions"] == []
