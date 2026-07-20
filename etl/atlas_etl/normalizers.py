from __future__ import annotations

from typing import Any, Iterable

from atlas_etl.models import (
    NormalizedDoctor,
    NormalizedDoctorFacilityLink,
    NormalizedFacility,
    NormalizedRegistration,
)
from atlas_etl.utils import normalize_crm, normalize_person_name, normalize_uf


def normalize_facility_row(
    row: dict[str, Any],
    *,
    source_code: str = "CNES",
    competence: str | None = None,
    source_file: str | None = None,
) -> NormalizedFacility:
    # Campos típicos CNES (nomes variam — mapeamos aliases comuns)
    cnes = _first(row, "CO_CNES", "CNES", "cnes_code", "cnes")
    name = _first(row, "NO_FANTASIA", "NO_RAZAO_SOCIAL", "legal_name", "nome") or "SEM NOME"
    legal = _first(row, "NO_RAZAO_SOCIAL", "legal_name") or name
    trade = _first(row, "NO_FANTASIA", "trade_name")
    return NormalizedFacility(
        cnes_code=str(cnes).strip() if cnes else None,
        cnpj=_digits(_first(row, "NU_CNPJ", "cnpj")),
        legal_name=str(legal).strip(),
        trade_name=str(trade).strip() if trade else None,
        facility_type=_first(row, "TP_UNIDADE", "facility_type"),
        legal_nature=_first(row, "CO_NATUREZA_JUR", "legal_nature"),
        city=_first(row, "NO_MUNICIPIO", "city"),
        state_uf=normalize_uf(_first(row, "CO_UF", "UF", "state_uf") or ""),
        ibge_city_code=_first(row, "CO_IBGE", "ibge_city_code"),
        address={
            "zip": _first(row, "CO_CEP", "address_zip"),
            "street": _first(row, "NO_LOGRADOURO", "address_street"),
            "number": _first(row, "NU_ENDERECO", "address_number"),
            "district": _first(row, "NO_BAIRRO", "address_district"),
        },
        phone=_first(row, "NU_TELEFONE", "phone"),
        email=_first(row, "NO_EMAIL", "email"),
        website=None,
        attends_sus=_boolish(_first(row, "TP_SUS", "attends_sus")),
        source_code=source_code,
        source_competence=competence,
        source_record_id=str(cnes) if cnes else None,
        raw_reference={"source_file": source_file},
    )


def normalize_doctor_row(
    row: dict[str, Any],
    *,
    source_code: str = "CNES",
    competence: str | None = None,
    source_file: str | None = None,
) -> NormalizedDoctor:
    name = _first(row, "NOMEPROF", "NO_PROFISSIONAL", "full_name", "nome") or ""
    crm = normalize_crm(_first(row, "CRM", "NU_CRM", "crm_number") or "")
    uf = normalize_uf(_first(row, "UF_CRM", "SG_UF_CRM", "crm_state", "UF") or "")
    cbo = _first(row, "COD_CBO", "CO_CBO", "cbo_code")
    return NormalizedDoctor(
        source_record_id=_first(row, "COD_PROF", "CO_PROFISSIONAL", "id") or f"{crm}-{uf}",
        full_name=str(name).strip(),
        normalized_name=normalize_person_name(str(name)),
        crm_number=crm or None,
        crm_state=uf or None,
        cbo_code=str(cbo).strip() if cbo else None,
        cbo_description=_first(row, "DS_CBO", "cbo_description"),
        city=_first(row, "NO_MUNICIPIO", "city"),
        state_uf=uf or None,
        source_code=source_code,
        source_competence=competence,
        source_file=source_file,
        raw_reference={"keys": list(row.keys())},
    )


def normalize_registration_from_doctor(doc: NormalizedDoctor) -> NormalizedRegistration | None:
    if not doc.crm_number or not doc.crm_state:
        return None
    return NormalizedRegistration(
        doctor_reference=doc.source_record_id,
        registration_type="CRM",
        number=doc.crm_number,
        state_uf=doc.crm_state,
        status="desconhecido",
        source_code=doc.source_code,
        source_competence=doc.source_competence,
    )


def normalize_link_row(
    row: dict[str, Any],
    *,
    source_code: str = "CNES",
    competence: str | None = None,
) -> NormalizedDoctorFacilityLink:
    return NormalizedDoctorFacilityLink(
        doctor_reference=str(
            _first(row, "COD_PROF", "CO_PROFISSIONAL", "doctor_reference") or ""
        ),
        facility_cnes=str(_first(row, "CO_CNES", "CNES", "facility_cnes") or ""),
        cbo_code=_first(row, "COD_CBO", "CO_CBO", "cbo_code"),
        link_type=_first(row, "TP_VINCULO", "link_type"),
        weekly_hours=_float(_first(row, "QT_CARGA_HORARIA", "weekly_hours")),
        attends_sus=_boolish(_first(row, "TP_SUS", "attends_sus")),
        competence=competence,
        source_code=source_code,
    )


def facilities_from_rows(rows: Iterable[dict[str, Any]], **kwargs: Any) -> list[NormalizedFacility]:
    return [normalize_facility_row(r, **kwargs) for r in rows]


def doctors_from_rows(rows: Iterable[dict[str, Any]], **kwargs: Any) -> list[NormalizedDoctor]:
    return [normalize_doctor_row(r, **kwargs) for r in rows]


def _first(row: dict[str, Any], *keys: str) -> str | None:
    lower_map = {str(k).lower(): v for k, v in row.items()}
    for key in keys:
        if key in row and row[key] not in (None, ""):
            return str(row[key])
        if key.lower() in lower_map and lower_map[key.lower()] not in (None, ""):
            return str(lower_map[key.lower()])
    return None


def _digits(value: str | None) -> str | None:
    if not value:
        return None
    d = "".join(c for c in value if c.isdigit())
    return d or None


def _boolish(value: str | None) -> bool | None:
    if value is None or value == "":
        return None
    v = str(value).strip().lower()
    if v in ("1", "s", "sim", "true", "t"):
        return True
    if v in ("0", "n", "nao", "não", "false", "f"):
        return False
    return None


def _float(value: str | None) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(str(value).replace(",", "."))
    except ValueError:
        return None
