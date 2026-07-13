import { describe, expect, it } from "vitest";
import { doctorCreateSchema, registrationSchema } from "@/services/doctors/schemas";
import { facilityCreateSchema } from "@/services/facilities/schemas";
import { linkSchema } from "@/services/links/schemas";
import { contactSchema } from "@/services/contacts/schemas";
import {
  buildDoctorNormalizedName,
  confidenceBand,
  maskContactValue,
  normalizeCrmNumber,
  normalizeCnpj,
  parsePageSize,
} from "@/lib/format";
import { canWrite, isMaster, canViewAudit } from "@/lib/permissions";
import { mapSupabaseError } from "@/lib/service-result";

describe("doctor schemas", () => {
  it("exige nome, cidade e UF", () => {
    const parsed = doctorCreateSchema.safeParse({
      full_name: "Ab",
      city: "BH",
      state_uf: "MG",
    });
    expect(parsed.success).toBe(false);
  });

  it("aceita candidato válido", () => {
    const parsed = doctorCreateSchema.safeParse({
      full_name: "Ana Souza",
      city: "Belo Horizonte",
      state_uf: "mg",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.state_uf).toBe("MG");
  });

  it("valida CRM com UF", () => {
    const parsed = registrationSchema.safeParse({
      doctor_id: "550e8400-e29b-41d4-a716-446655440000",
      registration_type: "CRM",
      number: "12345",
      state_uf: "MG",
      status: "desconhecido",
      is_primary: true,
      confidence_score: 20,
    });
    expect(parsed.success).toBe(true);
  });
});

describe("facility and link schemas", () => {
  it("valida estabelecimento", () => {
    const parsed = facilityCreateSchema.safeParse({
      name: "Hospital Demo",
      city: "Uberlândia",
      state_uf: "MG",
      has_hemodynamics: true,
    });
    expect(parsed.success).toBe(true);
  });

  it("bloqueia data final anterior", () => {
    const parsed = linkSchema.safeParse({
      doctor_id: "550e8400-e29b-41d4-a716-446655440000",
      facility_id: "6ba7b810-9dad-41d1-80b4-00c04fd430c8",
      started_on: "2024-01-10",
      ended_on: "2023-01-01",
    });
    expect(parsed.success).toBe(false);
  });

  it("exige justificativa para coordenador confirmado", () => {
    const parsed = linkSchema.safeParse({
      doctor_id: "550e8400-e29b-41d4-a716-446655440000",
      facility_id: "6ba7b810-9dad-41d1-80b4-00c04fd430c8",
      is_coordinator: true,
      coordinator_confirmed: true,
    });
    expect(parsed.success).toBe(false);
  });
});

describe("contacts and format", () => {
  it("exige médico ou estabelecimento", () => {
    const parsed = contactSchema.safeParse({
      channel: "email",
      value: "a@b.com",
    });
    expect(parsed.success).toBe(false);
  });

  it("normaliza busca e CRM", () => {
    expect(buildDoctorNormalizedName("José  da   Silva")).toBe("jose da silva");
    expect(normalizeCrmNumber("12.345")).toBe("12345");
    expect(normalizeCnpj("00.000.000/0001-91")).toBe("00000000000191");
    expect(parsePageSize("50")).toBe(50);
    expect(parsePageSize("7")).toBe(20);
  });

  it("mascara contato restrito", () => {
    expect(maskContactValue("ana@demo.com", "email", true)).toContain("***@");
  });

  it("faixas de confiança", () => {
    expect(confidenceBand(20)).toContain("Baixa");
    expect(confidenceBand(55)).toContain("validação");
    expect(confidenceBand(70)).toContain("moderada");
    expect(confidenceBand(90)).toContain("Alta");
  });
});

describe("permissions and errors", () => {
  it("respeita papéis", () => {
    expect(canWrite("analista")).toBe(true);
    expect(canWrite("visualizador")).toBe(false);
    expect(isMaster("master")).toBe(true);
    expect(canViewAudit("analista")).toBe(true);
  });

  it("mapeia erros sem vazar SQL", () => {
    const result = mapSupabaseError({
      code: "23505",
      message: "duplicate key value violates unique constraint",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).not.toMatch(/duplicate key value violates/i);
    }
  });
});
