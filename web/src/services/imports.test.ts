import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { canWrite, isMaster } from "@/lib/permissions";
import { EXPECTED_MIGRATIONS } from "@/lib/env";
import { normalizeCrmNumber } from "@/lib/format";
import {
  applyColumnMapping,
  parseCsvText,
  parseTabularFile,
} from "@/services/imports/parse";
import {
  IMPORT_ENTITY_TYPES,
  TEMPLATE_HEADERS,
  autoMapColumns,
  buildTemplateCsv,
} from "@/services/imports/templates";
import {
  markFacilityDuplicates,
  markRegistrationDuplicates,
  validateImportRow,
} from "@/services/imports/validate";

const fixturesDir = path.resolve(__dirname, "../test/fixtures");

function readFixture(name: string) {
  return fs.readFileSync(path.join(fixturesDir, name), "utf8");
}

describe("importações — permissões", () => {
  it("visualizador não pode importar", () => {
    expect(canWrite("visualizador")).toBe(false);
  });

  it("analista autorizado pode importar", () => {
    expect(canWrite("analista")).toBe(true);
  });

  it("master autorizado pode importar", () => {
    expect(canWrite("master")).toBe(true);
    expect(isMaster("master")).toBe(true);
  });
});

describe("importações — templates", () => {
  it("gera CSV com cabeçalhos e exemplo fictício para cada entidade", () => {
    for (const entity of IMPORT_ENTITY_TYPES) {
      const csv = buildTemplateCsv(entity);
      const headers = TEMPLATE_HEADERS[entity];
      expect(csv.startsWith(headers.join(","))).toBe(true);
      expect(csv.toLowerCase()).toMatch(/fict|example\.com|dado/);
      expect(csv).not.toMatch(/isabella@/i);
      expect(csv).not.toMatch(/\bCPF\b/i);
    }
  });

  it("template de médicos não exige birth_date nem CPF", () => {
    expect(TEMPLATE_HEADERS.doctors).not.toContain("cpf");
    expect(TEMPLATE_HEADERS.doctors).not.toContain("birth_date");
  });
});

describe("importações — parse CSV/XLSX", () => {
  it("faz upload/parse de CSV preservando zeros à esquerda no CRM", () => {
    const text = readFixture("registrations_duplicate_crm.csv");
    const parsed = parseCsvText(text);
    expect(parsed.rowCount).toBe(2);
    expect(parsed.rows[0]?.number).toBe("090001");
    expect(normalizeCrmNumber(parsed.rows[0]!.number)).toBe("090001");
  });

  it("parseia XLSX em memória", async () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ["full_name", "city", "state_uf"],
      ["Médico XLSX Demo", "BH", "MG"],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const file = new File([buffer], "demo.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const parsed = await parseTabularFile(file);
    expect(parsed.rowCount).toBe(1);
    expect(parsed.rows[0]?.full_name).toBe("Médico XLSX Demo");
    expect(parsed.encoding).toBe("xlsx");
  });

  it("mapeia colunas automaticamente", () => {
    const mapping = autoMapColumns(["Full_Name", "city", "state_uf"], "doctors");
    // case-insensitive exact match on lowercased header names
    expect(mapping.city).toBe("city");
    expect(mapping.state_uf).toBe("state_uf");
  });

  it("aplica mapeamento sem perder linha original", () => {
    const mapped = applyColumnMapping(
      { Nome: "Ana", UF: "mg" },
      { full_name: "Nome", state_uf: "UF" },
    );
    expect(mapped.full_name).toBe("Ana");
    expect(mapped.state_uf).toBe("mg");
  });
});

describe("importações — validação", () => {
  it("rejeita linha inválida de médico sem nome", () => {
    const text = readFixture("doctors_invalid.csv");
    const parsed = parseCsvText(text);
    const mapping = autoMapColumns(parsed.headers, "doctors");
    const mapped = applyColumnMapping(parsed.rows[0]!, mapping);
    const result = validateImportRow("doctors", mapped);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("full_name"))).toBe(true);
  });

  it("aceita médico válido do fixture", () => {
    const text = readFixture("doctors_valid.csv");
    const parsed = parseCsvText(text);
    const mapping = autoMapColumns(parsed.headers, "doctors");
    const mapped = applyColumnMapping(parsed.rows[0]!, mapping);
    const result = validateImportRow("doctors", mapped);
    expect(result.ok).toBe(true);
  });

  it("detecta CRM duplicado no arquivo", () => {
    const text = readFixture("registrations_duplicate_crm.csv");
    const parsed = parseCsvText(text);
    const mapping = autoMapColumns(parsed.headers, "registrations");
    const rows = parsed.rows.map((row) => {
      const mapped = applyColumnMapping(row, mapping);
      const result = validateImportRow("registrations", mapped);
      return { normalized: result.normalized, errors: result.errors };
    });
    const duplicates = markRegistrationDuplicates(rows);
    expect(duplicates).toBe(1);
    expect(rows[1]?.errors.some((e) => e.includes("duplicado"))).toBe(true);
  });

  it("detecta CNES duplicado no arquivo", () => {
    const text = readFixture("facilities_duplicate_cnes.csv");
    const parsed = parseCsvText(text);
    const mapping = autoMapColumns(parsed.headers, "facilities");
    const rows = parsed.rows.map((row) => {
      const mapped = applyColumnMapping(row, mapping);
      const result = validateImportRow("facilities", mapped);
      return { normalized: result.normalized, errors: result.errors };
    });
    const duplicates = markFacilityDuplicates(rows);
    expect(duplicates).toBe(1);
  });

  it("rejeita vínculo sem CRM do médico", () => {
    const text = readFixture("links_without_doctor.csv");
    const parsed = parseCsvText(text);
    const mapping = autoMapColumns(parsed.headers, "links");
    const mapped = applyColumnMapping(parsed.rows[0]!, mapping);
    const result = validateImportRow("links", mapped);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("doctor_crm"))).toBe(true);
  });

  it("rejeita vínculo sem estabelecimento", () => {
    const result = validateImportRow("links", {
      doctor_crm: "900001",
      doctor_crm_uf: "MG",
      facility_cnes: "",
      facility_name: "",
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("facility"))).toBe(true);
  });

  it("rejeita contato sem origem", () => {
    const text = readFixture("contacts_without_origin.csv");
    const parsed = parseCsvText(text);
    const mapping = autoMapColumns(parsed.headers, "contacts");
    const mapped = applyColumnMapping(parsed.rows[0]!, mapping);
    const result = validateImportRow("contacts", mapped);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("origem"))).toBe(true);
  });

  it("RQE exige doctor_name (médico correspondente)", () => {
    const result = validateImportRow("registrations", {
      doctor_name: "",
      registration_type: "RQE",
      number: "123",
      state_uf: "MG",
      source_code: "CRM_ESTADUAL",
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("doctor_name"))).toBe(true);
  });
});

describe("importações — fluxo e migration", () => {
  it("migration 012 está na lista esperada e adiciona file_hash", () => {
    expect(EXPECTED_MIGRATIONS).toContain("012_import_workflow_enrichment.sql");
    const sql = fs.readFileSync(
      path.resolve(__dirname, "../../../supabase/migrations/012_import_workflow_enrichment.sql"),
      "utf8",
    );
    expect(sql).toMatch(/file_hash/);
    expect(sql).toMatch(/validation_errors/);
    expect(sql).not.toMatch(/drop table/i);
  });

  it("fluxo documentado: RAW → candidato → review_queue (sem insert oficial direto)", () => {
    const mutations = fs.readFileSync(
      path.resolve(__dirname, "imports/mutations.ts"),
      "utf8",
    );
    expect(mutations).toMatch(/layer:\s*"candidato"/);
    expect(mutations).toMatch(/review_queue/);
    expect(mutations).toMatch(/import\.preview/);
    expect(mutations).toMatch(/import\.confirm/);
    expect(mutations).toMatch(/import\.reprocess/);
    expect(mutations).not.toMatch(/layer:\s*"oficial"/);
    // auditoria usa sessão (profile.id / writeAuditLog), sem e-mail fixo
    expect(mutations).not.toMatch(/isabella@/i);
    expect(mutations).toMatch(/uploaded_by:\s*profile\.id/);
    expect(mutations).toMatch(/confirmed_by:\s*profile\.id/);
  });

  it("reprocessamento é idempotente (pula vinculados)", () => {
    const mutations = fs.readFileSync(
      path.resolve(__dirname, "imports/mutations.ts"),
      "utf8",
    );
    expect(mutations).toMatch(/linked_doctor_id \|\| row\.linked_facility_id/);
    expect(mutations).toMatch(/reprocessImportAction/);
  });
});
