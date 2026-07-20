from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from atlas_etl.classifiers import doctor_match_key, name_suggestion_only
from atlas_etl.models import NormalizedDoctor, NormalizedFacility
from atlas_etl.utils import normalize_crm, normalize_uf


MatchType = Literal[
    "novo", "exato", "provavel", "duplicidade_provavel", "conflito", "revisao_obrigatoria"
]


@dataclass
class MatchResult:
    match_type: MatchType
    matched_entity_id: str | None
    confidence_score: int
    reasons: list[str]
    requires_review: bool


def match_doctor(
    doctor: NormalizedDoctor,
    existing_by_crm: dict[str, str],
    existing_by_name: dict[str, list[str]],
) -> MatchResult:
    key = doctor_match_key(
        normalize_crm(doctor.crm_number or ""),
        normalize_uf(doctor.crm_state or doctor.state_uf or ""),
    )
    if key and key in existing_by_crm:
        return MatchResult(
            match_type="exato",
            matched_entity_id=existing_by_crm[key],
            confidence_score=95,
            reasons=["CRM+UF"],
            requires_review=False,
        )
    if doctor.normalized_name in existing_by_name:
        ids = existing_by_name[doctor.normalized_name]
        if len(ids) == 1:
            return MatchResult(
                match_type="provavel",
                matched_entity_id=ids[0],
                confidence_score=40,
                reasons=["nome normalizado — sugestão apenas, sem merge automático"],
                requires_review=True,
            )
        return MatchResult(
            match_type="duplicidade_provavel",
            matched_entity_id=None,
            confidence_score=30,
            reasons=["múltiplos nomes iguais — revisão obrigatória"],
            requires_review=True,
        )
    return MatchResult(
        match_type="novo",
        matched_entity_id=None,
        confidence_score=20,
        reasons=["sem correspondência por CRM+UF"],
        requires_review=True,
    )


def match_facility(
    facility: NormalizedFacility,
    existing_by_cnes: dict[str, str],
    existing_by_cnpj: dict[str, str],
) -> MatchResult:
    if facility.cnes_code and facility.cnes_code in existing_by_cnes:
        return MatchResult(
            match_type="exato",
            matched_entity_id=existing_by_cnes[facility.cnes_code],
            confidence_score=98,
            reasons=["CNES"],
            requires_review=False,
        )
    if facility.cnpj and facility.cnpj in existing_by_cnpj:
        return MatchResult(
            match_type="exato",
            matched_entity_id=existing_by_cnpj[facility.cnpj],
            confidence_score=90,
            reasons=["CNPJ"],
            requires_review=True,
        )
    return MatchResult(
        match_type="novo",
        matched_entity_id=None,
        confidence_score=25,
        reasons=["sem CNES/CNPJ correspondente"],
        requires_review=True,
    )


def detect_crm_duplicates(rows: list[tuple[str, str]]) -> set[str]:
    seen: set[str] = set()
    dups: set[str] = set()
    for number, uf in rows:
        key = f"{normalize_crm(number)}|{normalize_uf(uf)}"
        if key in seen:
            dups.add(key)
        seen.add(key)
    return dups


__all__ = [
    "MatchResult",
    "match_doctor",
    "match_facility",
    "detect_crm_duplicates",
    "name_suggestion_only",
]
