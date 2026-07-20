import { describe, expect, it } from "vitest";
import { canWrite, isMaster } from "@/lib/permissions";
import { EXPECTED_MIGRATIONS } from "@/lib/env";
import fs from "node:fs";
import path from "node:path";

describe("ingestão automática", () => {
  it("migrations 013–017 estão listadas", () => {
    expect(EXPECTED_MIGRATIONS).toContain("013_ingestion_jobs.sql");
    expect(EXPECTED_MIGRATIONS).toContain("017_ingestion_rls_and_rpcs.sql");
  });

  it("013 depende conceitualmente de 012 e não edita 001–012", () => {
    const root = path.resolve(__dirname, "../../..");
    const sql013 = fs.readFileSync(
      path.join(root, "supabase/migrations/013_ingestion_jobs.sql"),
      "utf8",
    );
    expect(sql013).toMatch(/ingestion_jobs/);
    expect(sql013).toMatch(/012|import_batches|data_sources/i);
  });

  it("017 usa can_write e nunca promove GOLDEN", () => {
    const root = path.resolve(__dirname, "../../..");
    const sql = fs.readFileSync(
      path.join(root, "supabase/migrations/017_ingestion_rls_and_rpcs.sql"),
      "utf8",
    );
    expect(sql).toMatch(/can_write\(\)/);
    expect(sql).toMatch(/enqueue_ingestion_job/);
    expect(sql).not.toMatch(/update\s+public\.doctors[\s\S]*layer\s*=\s*'oficial'/i);
    expect(sql).not.toMatch(/set\s+layer\s*=\s*'oficial'/i);
  });

  it("mutations de ingestão não hardcodam e-mail e usam sessão", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "ingestion/mutations.ts"),
      "utf8",
    );
    expect(src).toMatch(/requireWriter/);
    expect(src).toMatch(/enqueue_ingestion_job/);
    expect(src).toMatch(/manual_field_overrides/);
    expect(src).not.toMatch(/isabella@/i);
    expect(src).not.toMatch(/SERVICE_ROLE/);
  });

  it("pipeline Python nunca escreve layer oficial", () => {
    const py = fs.readFileSync(
      path.resolve(__dirname, "../../../etl/atlas_etl/pipeline.py"),
      "utf8",
    );
    expect(py).toMatch(/layer.: .candidato./);
    expect(py).not.toMatch(/"oficial"/);
    expect(py).toMatch(/review_queue/);
  });

  it("permissões: visualizador não inicia; master/analista sim", () => {
    expect(canWrite("visualizador")).toBe(false);
    expect(canWrite("analista")).toBe(true);
    expect(isMaster("master")).toBe(true);
  });

  it("workflows GitHub Actions existem", () => {
    const root = path.resolve(__dirname, "../../..");
    for (const name of [
      "cnes-ingestion.yml",
      "cnes-scheduled-refresh.yml",
      "process-ingestion-queue.yml",
    ]) {
      expect(
        fs.existsSync(path.join(root, ".github/workflows", name)),
      ).toBe(true);
    }
  });
});
