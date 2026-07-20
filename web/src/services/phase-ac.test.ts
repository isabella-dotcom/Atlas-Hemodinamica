import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
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
import { canWrite, isMaster, canViewAudit } from "@/lib/permissions";
import { EXPECTED_MIGRATIONS } from "@/lib/env";
import { maskContactValue } from "@/lib/format";

const root = path.resolve(__dirname, "../../..");

function readRepo(...parts: string[]) {
  return fs.readFileSync(path.join(root, ...parts), "utf8");
}

const DOCTOR_ID = "550e8400-e29b-41d4-a716-446655440000";
const FACILITY_ID = "6ba7b810-9dad-41d1-80b4-00c04fd430c8";
const SPECIALTY_ID = "7ba7b810-9dad-41d1-80b4-00c04fd430c9";

describe("migrations e seed", () => {
  it("lista migrations 007–012 esperadas", () => {
    expect(EXPECTED_MIGRATIONS).toContain("007_doctor_profile_enrichment.sql");
    expect(EXPECTED_MIGRATIONS).toContain("011_ensure_phase_ac_schema.sql");
    expect(EXPECTED_MIGRATIONS).toContain("012_import_workflow_enrichment.sql");
  });

  it("011 é idempotente (if not exists)", () => {
    const sql = readRepo("supabase", "migrations", "011_ensure_phase_ac_schema.sql");
    expect(sql).toMatch(/add column if not exists/i);
    expect(sql).toMatch(/add value if not exists/i);
    expect(sql).toMatch(/diagnostic_phase_ac_check/);
    expect(sql).not.toMatch(/drop table/i);
  });

  it("seed demo marca DADO FICTÍCIO e is_demo", () => {
    const sql = readRepo("supabase", "seed", "001_demo_data.sql");
    expect(sql).toContain("DADO FICTÍCIO");
    expect(sql).toContain("is_demo");
    expect(sql).toContain("example.com");
    expect(sql).toContain("CRM FICTÍCIO");
    expect(sql).toMatch(/on conflict/i);
  });

  it("clear remove somente demo", () => {
    const sql = readRepo("supabase", "seed", "999_clear_demo_data.sql");
    expect(sql).toMatch(/is_demo\s*=\s*true/i);
    expect(sql).not.toMatch(/truncate\s+public\.doctors/i);
  });
});

describe("CRUD schemas — médico e estabelecimento", () => {
  it("cadastra médico completo", () => {
    const parsed = doctorCreateSchema.safeParse({
      full_name: "Médico Demonstração 001",
      city: "Belo Horizonte",
      state_uf: "MG",
      biography: "DADO FICTÍCIO",
      graduation_year: 2010,
      orcid: "0000-0002-1825-0097",
      confidence_score: 40,
    });
    expect(parsed.success).toBe(true);
  });

  it("edita médico", () => {
    const parsed = doctorUpdateSchema.safeParse({
      biography: "Atualizado",
      classification: "falecido",
      is_sbhci_member: true,
    });
    expect(parsed.success).toBe(true);
  });

  it("cadastra e edita estabelecimento", () => {
    expect(
      facilityCreateSchema.safeParse({
        name: "Hospital Demonstração Belo Horizonte",
        city: "Belo Horizonte",
        state_uf: "MG",
        has_hemodynamics: true,
        has_catheterization_lab: true,
        ownership_type: "privado",
      }).success,
    ).toBe(true);
    expect(
      facilityUpdateSchema.safeParse({
        service_notes: "DADO FICTÍCIO",
        has_interventional_cardiology: true,
      }).success,
    ).toBe(true);
  });
});

describe("CRM RQE especialidades vínculos contatos evidências", () => {
  it("CRM e RQE", () => {
    expect(
      registrationSchema.safeParse({
        doctor_id: DOCTOR_ID,
        registration_type: "CRM",
        number: "900001",
        state_uf: "MG",
        notes: "CRM FICTÍCIO — NÃO UTILIZAR",
      }).success,
    ).toBe(true);
    expect(
      registrationSchema.safeParse({
        doctor_id: DOCTOR_ID,
        registration_type: "RQE",
        number: "910001",
        state_uf: "MG",
        rqe_area: "Hemodinâmica",
      }).success,
    ).toBe(true);
  });

  it("especialidade", () => {
    expect(
      doctorSpecialtySchema.safeParse({
        doctor_id: DOCTOR_ID,
        specialty_id: SPECIALTY_ID,
        is_primary: true,
        is_confirmed: true,
      }).success,
    ).toBe(true);
  });

  it("vínculo criar e encerrar", () => {
    expect(
      linkSchema.safeParse({
        doctor_id: DOCTOR_ID,
        facility_id: FACILITY_ID,
        function_title: "Hemodinamicista",
        is_team_leader: true,
        weekly_hours: 20,
      }).success,
    ).toBe(true);
    expect(
      linkUpdateSchema.safeParse({
        status: "encerrado",
        ended_on: "2026-01-01",
        started_on: "2020-01-01",
      }).success,
    ).toBe(true);
  });

  it("contato criar e validar", () => {
    const created = contactSchema.safeParse({
      doctor_id: DOCTOR_ID,
      channel: "email",
      value: "medico001@example.com",
    });
    expect(created.success).toBe(true);
    expect(
      contactUpdateSchema.safeParse({ contact_status: "valido" }).success,
    ).toBe(true);
  });

  it("evidência", () => {
    expect(
      evidenceSchema.safeParse({
        entity_type: "doctor",
        entity_id: DOCTOR_ID,
        title: "Evidência fictícia",
        url: "https://evidencia-demo.example.com",
        status: "pendente",
      }).success,
    ).toBe(true);
  });
});

describe("permissões e dados sensíveis", () => {
  it("master e analista editam; visualizador não", () => {
    expect(canWrite("master")).toBe(true);
    expect(canWrite("analista")).toBe(true);
    expect(canWrite("visualizador")).toBe(false);
    expect(isMaster("master")).toBe(true);
    expect(canViewAudit("visualizador")).toBe(false);
  });

  it("protege contatos restritos na UI", () => {
    expect(maskContactValue("medico001@example.com", "email", true)).toContain("***");
  });

  it("birth_date não é obrigatório no create público", () => {
    const parsed = doctorCreateSchema.safeParse({
      full_name: "Médico Demonstração 002",
      city: "Uberlândia",
      state_uf: "MG",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.birth_date ?? null).toBeNull();
  });
});
