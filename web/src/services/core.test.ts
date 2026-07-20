import { describe, expect, it } from "vitest";
import {
  doctorCreateSchema,
  doctorUpdateSchema,
  registrationSchema,
  doctorSpecialtySchema,
} from "@/services/doctors/schemas";
import {
  facilityCreateSchema,
  facilityUpdateSchema,
} from "@/services/facilities/schemas";
import { linkSchema, linkUpdateSchema } from "@/services/links/schemas";
import { contactSchema, contactUpdateSchema } from "@/services/contacts/schemas";
import { evidenceSchema } from "@/services/evidences/schemas";
import {
  buildDoctorNormalizedName,
  confidenceBand,
  formatPhoneDisplay,
  maskContactValue,
  maskPhoneInput,
  normalizeCrmNumber,
  normalizeCnpj,
  normalizePhoneDigits,
  parsePageSize,
} from "@/lib/format";
import { canWrite, isMaster, canViewAudit } from "@/lib/permissions";
import { mapSupabaseError } from "@/lib/service-result";
import {
  birthDateSchema,
  graduationYearSchema,
  optionalLatitudeSchema,
  optionalLongitudeSchema,
  optionalOrcidSchema,
} from "@/lib/validation";

const DOCTOR_ID = "550e8400-e29b-41d4-a716-446655440000";
const FACILITY_ID = "6ba7b810-9dad-41d1-80b4-00c04fd430c8";
const SPECIALTY_ID = "7ba7b810-9dad-41d1-80b4-00c04fd430c9";

describe("schema completo de médico", () => {
  it("aceita perfil enriquecido", () => {
    const parsed = doctorCreateSchema.safeParse({
      full_name: "Ana Souza Hemodinâmica",
      city: "Belo Horizonte",
      state_uf: "mg",
      social_name: "Ana",
      sex: "F",
      birth_date: "1985-03-10",
      nationality: "Brasileira",
      biography: "Especialista em hemodinâmica",
      graduation_year: 2010,
      graduation_institution: "UFMG",
      lattes_url: "https://lattes.cnpq.br/123",
      orcid: "0000-0002-1825-0097",
      practice_keywords: "hemodinâmica, cateterismo",
      fellowships: "SBHCI",
      confidence_score: 40,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.state_uf).toBe("MG");
      expect(parsed.data.practice_keywords).toContain("hemodinâmica");
      expect(parsed.data.orcid).toBe("0000-0002-1825-0097");
    }
  });

  it("rejeita confiança fora do intervalo", () => {
    const parsed = doctorCreateSchema.safeParse({
      full_name: "Ana Souza",
      city: "BH",
      state_uf: "MG",
      confidence_score: 120,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejeita data de nascimento futura", () => {
    const parsed = birthDateSchema().safeParse("2999-01-01");
    expect(parsed.success).toBe(false);
  });

  it("rejeita ano de graduação futuro", () => {
    const parsed = graduationYearSchema().safeParse(2099);
    expect(parsed.success).toBe(false);
  });

  it("valida ORCID", () => {
    expect(optionalOrcidSchema.safeParse("0000-0002-1825-0097").success).toBe(true);
    expect(optionalOrcidSchema.safeParse("orcid-invalido").success).toBe(false);
  });
});

describe("atualização de médico", () => {
  it("aceita patch parcial", () => {
    const parsed = doctorUpdateSchema.safeParse({
      biography: "Atualizado",
      confidence_score: 55,
      classification: "falecido",
    });
    expect(parsed.success).toBe(true);
  });

  it("aceita registro_duplicado", () => {
    const parsed = doctorUpdateSchema.safeParse({
      classification: "registro_duplicado",
    });
    expect(parsed.success).toBe(true);
  });
});

describe("schema completo de estabelecimento", () => {
  it("aceita campos assistenciais e geo", () => {
    const parsed = facilityCreateSchema.safeParse({
      name: "Hospital Demo MG",
      city: "Uberlândia",
      state_uf: "MG",
      has_hemodynamics: true,
      ownership_type: "privado",
      branch_type: "matriz",
      latitude: -18.9186,
      longitude: -48.2772,
      hemodynamics_phone: "(34) 99999-1234",
      has_catheterization_lab: true,
      attends_private: "yes",
      estimated_rooms: 2,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.hemodynamics_phone).toBe("34999991234");
      expect(parsed.data.latitude).toBeCloseTo(-18.9186);
    }
  });

  it("rejeita latitude inválida", () => {
    expect(optionalLatitudeSchema.safeParse(120).success).toBe(false);
    expect(optionalLongitudeSchema.safeParse(-200).success).toBe(false);
  });
});

describe("atualização de estabelecimento", () => {
  it("aceita patch parcial", () => {
    const parsed = facilityUpdateSchema.safeParse({
      has_interventional_cardiology: true,
      service_notes: "Sala híbrida",
    });
    expect(parsed.success).toBe(true);
  });
});

describe("registros profissionais", () => {
  it("inclui CRM", () => {
    const parsed = registrationSchema.safeParse({
      doctor_id: DOCTOR_ID,
      registration_type: "CRM",
      number: "12345",
      state_uf: "MG",
      status: "ativo",
      is_primary: true,
      consulted_at: "2026-01-10",
      verification_status: "verificado",
    });
    expect(parsed.success).toBe(true);
  });

  it("inclui RQE com área", () => {
    const parsed = registrationSchema.safeParse({
      doctor_id: DOCTOR_ID,
      registration_type: "RQE",
      number: "9876",
      state_uf: "MG",
      rqe_area: "Hemodinâmica",
      specialty_id: SPECIALTY_ID,
    });
    expect(parsed.success).toBe(true);
  });

  it("normaliza CRM preservando dígitos", () => {
    expect(normalizeCrmNumber("012.345")).toBe("012345");
  });
});

describe("especialidades", () => {
  it("inclui especialidade com flags", () => {
    const parsed = doctorSpecialtySchema.safeParse({
      doctor_id: DOCTOR_ID,
      specialty_id: SPECIALTY_ID,
      is_primary: true,
      is_confirmed: true,
      confidence_score: 80,
    });
    expect(parsed.success).toBe(true);
  });
});

describe("vínculos", () => {
  it("cria vínculo enriquecido", () => {
    const parsed = linkSchema.safeParse({
      doctor_id: DOCTOR_ID,
      facility_id: FACILITY_ID,
      function_title: "Hemodinamicista",
      role_title: "Médico",
      practiced_specialty: "Hemodinâmica",
      is_coordinator: true,
      is_team_leader: true,
      is_technical_responsible: false,
      is_clinical_staff: true,
      weekly_hours: 20,
      is_sus_link: true,
      coordinator_justification: "Confirmado pelo site do hospital",
      coordinator_confirmed: true,
    });
    expect(parsed.success).toBe(true);
  });

  it("encerra vínculo com datas válidas", () => {
    const parsed = linkUpdateSchema.safeParse({
      status: "encerrado",
      started_on: "2020-01-01",
      ended_on: "2026-01-01",
    });
    expect(parsed.success).toBe(true);
  });

  it("bloqueia término anterior ao início", () => {
    const parsed = linkUpdateSchema.safeParse({
      started_on: "2024-01-10",
      ended_on: "2023-01-01",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("contatos", () => {
  it("cria e normaliza telefone", () => {
    const parsed = contactSchema.safeParse({
      doctor_id: DOCTOR_ID,
      channel: "whatsapp",
      value: "(31) 98888-7777",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.value).toBe("31988887777");
  });

  it("valida status do contato", () => {
    const parsed = contactUpdateSchema.safeParse({
      contact_status: "valido",
      is_primary: true,
    });
    expect(parsed.success).toBe(true);
  });

  it("exige médico ou estabelecimento", () => {
    const parsed = contactSchema.safeParse({
      channel: "email",
      value: "a@b.com",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("evidências", () => {
  it("cria evidência com URL e campo", () => {
    const parsed = evidenceSchema.safeParse({
      entity_type: "doctor",
      entity_id: DOCTOR_ID,
      title: "Site hospitalar",
      url: "https://hospital.example.com/equipe",
      confirmed_field: "role_title",
      captured_value: "Coordenador",
      status: "pendente",
    });
    expect(parsed.success).toBe(true);
  });
});

describe("permissões e proteção de dados", () => {
  it("visualizador não escreve", () => {
    expect(canWrite("visualizador")).toBe(false);
    expect(canWrite("analista")).toBe(true);
    expect(isMaster("master")).toBe(true);
    expect(canViewAudit("visualizador")).toBe(false);
  });

  it("mascara contato restrito para visualizador", () => {
    expect(maskContactValue("ana@hospital.com", "email", true)).toContain("***");
    expect(maskContactValue("31999998888", "telefone", true).endsWith("8888")).toBe(
      true,
    );
  });

  it("birth_date fica em tabela sensível (contrato de app)", () => {
    // Visualizador: getDoctorById força birth_date=null se RLS negar a tabela.
    // Contrato: birth_date nunca deve ser exigido no create público.
    const parsed = doctorCreateSchema.safeParse({
      full_name: "Ana Souza",
      city: "BH",
      state_uf: "MG",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.birth_date ?? null).toBeNull();
  });
});

describe("formatadores", () => {
  it("normaliza busca e telefone", () => {
    expect(buildDoctorNormalizedName("José  da   Silva")).toBe("jose da silva");
    expect(normalizePhoneDigits("(31) 98888-7777")).toBe("31988887777");
    expect(formatPhoneDisplay("31988887777")).toBe("(31) 98888-7777");
    expect(maskPhoneInput("31988887777")).toBe("(31) 98888-7777");
    expect(normalizeCnpj("00.000.000/0001-91")).toBe("00000000000191");
    expect(parsePageSize("50")).toBe(50);
    expect(confidenceBand(30)).toBe("Baixa confiança");
  });

  it("mapeia erros de unicidade de registro", () => {
    const mapped = mapSupabaseError(
      { code: "23505", message: "duplicate key" },
      "Falha",
    );
    expect(mapped.success).toBe(false);
  });
});
