from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class NormalizedDoctor(BaseModel):
    source_record_id: str
    full_name: str
    normalized_name: str
    crm_number: str | None = None
    crm_state: str | None = None
    cbo_code: str | None = None
    cbo_description: str | None = None
    city: str | None = None
    state_uf: str | None = None
    source_code: str
    source_competence: str | None = None
    source_file: str | None = None
    raw_reference: dict[str, Any] = Field(default_factory=dict)


class NormalizedRegistration(BaseModel):
    doctor_reference: str
    registration_type: Literal["CRM", "RQE"] = "CRM"
    number: str
    state_uf: str
    status: str | None = "desconhecido"
    source_code: str
    source_competence: str | None = None


class NormalizedFacility(BaseModel):
    cnes_code: str | None = None
    cnpj: str | None = None
    legal_name: str
    trade_name: str | None = None
    facility_type: str | None = None
    legal_nature: str | None = None
    city: str | None = None
    state_uf: str | None = None
    ibge_city_code: str | None = None
    address: dict[str, str | None] = Field(default_factory=dict)
    phone: str | None = None
    email: str | None = None
    website: str | None = None
    attends_sus: bool | None = None
    source_code: str
    source_competence: str | None = None
    source_record_id: str | None = None
    raw_reference: dict[str, Any] = Field(default_factory=dict)


class NormalizedDoctorFacilityLink(BaseModel):
    doctor_reference: str
    facility_cnes: str
    cbo_code: str | None = None
    link_type: str | None = None
    weekly_hours: float | None = None
    attends_sus: bool | None = None
    competence: str | None = None
    source_code: str


class NormalizedService(BaseModel):
    facility_cnes: str
    service_code: str | None = None
    service_description: str | None = None
    classification_code: str | None = None
    classification_description: str | None = None
    active: bool = True
    competence: str | None = None


class NormalizedEquipment(BaseModel):
    facility_cnes: str
    equipment_code: str | None = None
    equipment_description: str | None = None
    quantity: int | None = None
    in_use_quantity: int | None = None
    competence: str | None = None


class NormalizedEvidence(BaseModel):
    entity_type: str
    source_code: str
    source_url: str | None = None
    source_file: str | None = None
    source_row: str | None = None
    confirmed_field: str | None = None
    captured_value: str | None = None
    captured_at: str | None = None
    competence: str | None = None


class NormalizedContact(BaseModel):
    doctor_reference: str | None = None
    facility_cnes: str | None = None
    contact_type: str
    contact_value: str
    is_institutional: bool = True
    source_code: str
    source_origin: str
    competence: str | None = None
