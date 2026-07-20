from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from atlas_etl.utils import load_yaml, normalize_person_name


@dataclass
class ScoreBreakdown:
    total: int = 0
    parts: list[dict[str, Any]] = field(default_factory=list)
    classification: str = "possivel_candidato"

    def add(self, rule_id: str, points: int, justification: str) -> None:
        self.parts.append(
            {"rule_id": rule_id, "points": points, "justification": justification}
        )
        self.total += points


class HemodynamicsClassifier:
    def __init__(self) -> None:
        self.rules = load_yaml("hemodynamics_rules.yaml")
        self.thresholds = self.rules.get("thresholds", {})
        self.max_auto = self.rules.get("max_auto_classification", "atuacao_provavel")

    def score_facility(
        self,
        *,
        equipment_codes: list[str] | None = None,
        service_texts: list[str] | None = None,
        cbo_codes: list[str] | None = None,
        sector_name: str | None = None,
        facility_type: str | None = None,
        doctor_count: int = 0,
        already_validated: bool = False,
        has_institutional_evidence: bool = False,
    ) -> ScoreBreakdown:
        result = ScoreBreakdown()
        equipment_codes = [c.strip() for c in (equipment_codes or []) if c]
        cbo_codes = [c.strip() for c in (cbo_codes or []) if c]
        service_texts = service_texts or []

        for rule in self.rules.get("rules", []):
            rid = rule["id"]
            points = int(rule.get("points", 0))
            just = rule.get("justification", rid)
            signal = rule.get("signal")

            if signal == "equipment":
                codes = set(rule.get("codes") or [])
                if codes and codes.intersection(equipment_codes):
                    result.add(rid, points, just)
                elif not codes:
                    # Sem códigos confirmados: pontua por hint textual se houver
                    hints = [h.lower() for h in rule.get("code_hints") or []]
                    blob = " ".join(service_texts + equipment_codes).lower()
                    if any(h in blob for h in hints):
                        result.add(rid, min(points, 15), just + " (hint textual — validar código)")

            elif signal == "specialized_service":
                codes = set(rule.get("codes") or [])
                blob = " ".join(service_texts).lower()
                if codes and any(c.lower() in blob for c in codes):
                    result.add(rid, points, just)
                else:
                    hints = [h.lower() for h in rule.get("code_hints") or []]
                    if any(h in blob for h in hints):
                        result.add(rid, min(points, 20), just + " (hint textual)")

            elif signal == "cbo":
                codes = set(rule.get("codes") or [])
                if codes.intersection(cbo_codes):
                    result.add(rid, points, just)

            elif signal == "sector_name" and sector_name:
                for pat in rule.get("patterns") or []:
                    if re.search(pat, sector_name):
                        result.add(rid, points, just)
                        break

            elif signal == "facility_type" and facility_type:
                for pat in rule.get("patterns") or []:
                    if re.search(pat, facility_type):
                        result.add(rid, points, just)
                        break

            elif signal == "professional_links":
                if doctor_count >= int(rule.get("min_doctors", 1)):
                    result.add(rid, points, just)

            elif signal == "prior_validation" and already_validated:
                result.add(rid, points, just)

            elif signal == "evidence" and has_institutional_evidence:
                result.add(rid, points, just)

        t_cand = int(self.thresholds.get("possivel_candidato", 25))
        t_prov = int(self.thresholds.get("atuacao_provavel", 55))
        if result.total >= t_prov:
            result.classification = "atuacao_provavel"
        elif result.total >= t_cand:
            result.classification = "possivel_candidato"
        else:
            result.classification = "possivel_candidato" if result.total > 0 else "rejeitado"

        # Nunca ultrapassar classificação automática máxima
        if result.classification not in ("possivel_candidato", "atuacao_provavel", "rejeitado"):
            result.classification = self.max_auto
        if result.classification in (
            "especialista_confirmado",
            "atuacao_institucional_confirmada",
        ):
            result.classification = self.max_auto

        return result

    def score_doctor(self, cbo_code: str | None, facility_score: int = 0) -> ScoreBreakdown:
        result = ScoreBreakdown()
        if cbo_code:
            fac = self.score_facility(cbo_codes=[cbo_code])
            result.parts.extend(fac.parts)
            result.total += fac.total
        if facility_score >= 55:
            result.add(
                "linked_hemo_facility",
                15,
                "Vinculado a estabelecimento com sinal de hemodinâmica",
            )
        t_cand = int(self.thresholds.get("possivel_candidato", 25))
        t_prov = int(self.thresholds.get("atuacao_provavel", 55))
        if result.total >= t_prov:
            result.classification = "atuacao_provavel"
        elif result.total >= t_cand:
            result.classification = "possivel_candidato"
        else:
            result.classification = "possivel_candidato" if result.total > 0 else "rejeitado"
        return result


def doctor_match_key(crm: str | None, uf: str | None) -> str | None:
    if not crm or not uf:
        return None
    return f"{crm}|{uf.upper()}"


def name_suggestion_only(name_a: str, name_b: str) -> bool:
    """Similaridade por nome — NUNCA merge automático."""
    return normalize_person_name(name_a) == normalize_person_name(name_b)
