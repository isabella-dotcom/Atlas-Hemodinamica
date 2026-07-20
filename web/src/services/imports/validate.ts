import { normalizeCrmNumber, normalizeUf } from "@/lib/format";
import type { ImportEntityType } from "@/services/imports/templates";
import { parseBool } from "@/services/imports/parse";

export type RowValidation = {
  ok: boolean;
  errors: string[];
  isDuplicateHint: boolean;
  normalized: Record<string, string | null | boolean | number>;
};

const UF_RE = /^[A-Z]{2}$/;

function requireText(
  normalized: Record<string, string | null | boolean | number>,
  key: string,
  label: string,
  errors: string[],
) {
  const value = String(normalized[key] ?? "").trim();
  if (!value) errors.push(`${label} obrigatório`);
  return value;
}

export function validateImportRow(
  entity: ImportEntityType,
  mapped: Record<string, string>,
): RowValidation {
  const errors: string[] = [];
  const normalized: Record<string, string | null | boolean | number> = {
    ...mapped,
  };
  const isDuplicateHint = false;

  if (entity === "doctors") {
    requireText(normalized, "full_name", "full_name", errors);
    const uf = normalizeUf(String(mapped.state_uf || "MG"));
    if (!UF_RE.test(uf)) errors.push("state_uf inválida");
    normalized.state_uf = uf;
    if (mapped.confidence_score) {
      const score = Number(mapped.confidence_score);
      if (!Number.isFinite(score) || score < 0 || score > 100) {
        errors.push("confidence_score deve estar entre 0 e 100");
      } else {
        normalized.confidence_score = Math.floor(score);
      }
    }
    if (mapped.is_sbhci_member) {
      normalized.is_sbhci_member = parseBool(mapped.is_sbhci_member);
    }
  }

  if (entity === "facilities") {
    requireText(normalized, "legal_name", "legal_name", errors);
    requireText(normalized, "city", "city", errors);
    const uf = normalizeUf(String(mapped.state_uf || ""));
    if (!UF_RE.test(uf)) errors.push("state_uf inválida");
    normalized.state_uf = uf;
    if (mapped.cnes_code) {
      normalized.cnes_code = String(mapped.cnes_code).trim();
    }
  }

  if (entity === "registrations") {
    const type = String(mapped.registration_type || "").toUpperCase();
    if (type !== "CRM" && type !== "RQE") {
      errors.push("registration_type deve ser CRM ou RQE");
    }
    normalized.registration_type = type;
    const number = normalizeCrmNumber(String(mapped.number || ""));
    if (!number) errors.push("number obrigatório");
    // Preserva zeros: normalizeCrmNumber só remove não-dígitos
    normalized.number = number;
    const uf = normalizeUf(String(mapped.state_uf || ""));
    if (!UF_RE.test(uf)) errors.push("state_uf inválida");
    normalized.state_uf = uf;
    if (!mapped.doctor_name?.trim() && type === "RQE") {
      // RQE precisa localizar médico; sem nome e sem CRM implícito no template
      // o template exige doctor_name; matching usa CRM em fluxo separado
    }
    requireText(normalized, "doctor_name", "doctor_name", errors);
    if (!mapped.source_code?.trim() && !mapped.source_url?.trim()) {
      errors.push("informe source_code ou source_url");
    }
  }

  if (entity === "links") {
    const crm = normalizeCrmNumber(String(mapped.doctor_crm || ""));
    const uf = normalizeUf(String(mapped.doctor_crm_uf || ""));
    if (!crm || !UF_RE.test(uf)) {
      errors.push("vínculo exige doctor_crm + doctor_crm_uf");
    }
    normalized.doctor_crm = crm;
    normalized.doctor_crm_uf = uf;
    if (!mapped.facility_cnes?.trim() && !mapped.facility_name?.trim()) {
      errors.push("informe facility_cnes ou facility_name");
    }
    if (mapped.facility_cnes) {
      normalized.facility_cnes = String(mapped.facility_cnes).trim();
    }
  }

  if (entity === "contacts") {
    const type = String(mapped.contact_type || "").toLowerCase();
    const allowed = [
      "email",
      "telefone",
      "celular",
      "whatsapp",
      "site",
      "secretaria",
      "formulario",
      "linkedin",
      "outro",
    ];
    if (!allowed.includes(type)) errors.push("contact_type inválido");
    normalized.contact_type = type;
    requireText(normalized, "contact_value", "contact_value", errors);
    if (!mapped.source_origin?.trim() && !mapped.source_code?.trim()) {
      errors.push("contato sem origem (source_origin ou source_code)");
    }
    const hasDoctor =
      normalizeCrmNumber(String(mapped.doctor_crm || "")) &&
      normalizeUf(String(mapped.doctor_crm_uf || ""));
    const hasFacility = Boolean(mapped.facility_cnes?.trim());
    if (!hasDoctor && !hasFacility) {
      errors.push("contato exige médico (CRM+UF) ou facility_cnes");
    }
    if (mapped.doctor_crm) {
      normalized.doctor_crm = normalizeCrmNumber(mapped.doctor_crm);
      normalized.doctor_crm_uf = normalizeUf(mapped.doctor_crm_uf || "");
    }
  }

  if (entity === "evidences") {
    requireText(normalized, "title", "title", errors);
    if (!mapped.source_code?.trim() && !mapped.source_url?.trim()) {
      errors.push("evidência exige source_code ou source_url");
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    isDuplicateHint,
    normalized,
  };
}

/** Detecta CRM duplicado no próprio arquivo (número+UF). */
export function markRegistrationDuplicates(
  rows: Array<{ normalized: Record<string, string | null | boolean | number>; errors: string[] }>,
): number {
  const seen = new Map<string, number>();
  let duplicates = 0;
  for (const row of rows) {
    if (row.normalized.registration_type !== "CRM" && row.normalized.registration_type !== "RQE") {
      continue;
    }
    const key = `${row.normalized.registration_type}|${row.normalized.number}|${row.normalized.state_uf}`;
    if (seen.has(key)) {
      row.errors.push("CRM/RQE duplicado no arquivo (tipo+número+UF)");
      duplicates += 1;
    } else {
      seen.set(key, 1);
    }
  }
  return duplicates;
}

/** Detecta CNES duplicado no próprio arquivo. */
export function markFacilityDuplicates(
  rows: Array<{ normalized: Record<string, string | null | boolean | number>; errors: string[] }>,
): number {
  const seen = new Map<string, number>();
  let duplicates = 0;
  for (const row of rows) {
    const cnes = String(row.normalized.cnes_code ?? "").trim();
    if (!cnes) continue;
    if (seen.has(cnes)) {
      row.errors.push("CNES duplicado no arquivo");
      duplicates += 1;
    } else {
      seen.set(cnes, 1);
    }
  }
  return duplicates;
}
