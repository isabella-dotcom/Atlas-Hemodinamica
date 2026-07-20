#!/usr/bin/env node
/**
 * Seed de demonstração (fictício).
 * NÃO executa SQL automaticamente no Supabase remoto.
 * Imprime os arquivos e valida salvaguardas de ambiente.
 *
 * Uso:
 *   node scripts/seed-demo.mjs apply
 *   node scripts/seed-demo.mjs clear
 *   ATLAS_ALLOW_DEMO_SEED=true node scripts/seed-demo.mjs apply
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const mode = process.argv[2] === "clear" ? "clear" : "apply";

const files =
  mode === "clear"
    ? ["supabase/seed/999_clear_demo_data.sql"]
    : [
        "supabase/seed/001_demo_data.sql",
        "supabase/seed/002_demo_review_queue.sql",
      ];

function fail(message) {
  console.error(`\n[seed:demo] ERRO: ${message}\n`);
  process.exit(1);
}

if (process.env.NODE_ENV === "production" && process.env.ATLAS_ALLOW_DEMO_SEED !== "true") {
  fail(
    "Recusado em NODE_ENV=production. Defina ATLAS_ALLOW_DEMO_SEED=true apenas em homologação controlada.",
  );
}

if (process.env.VERCEL_ENV === "production" && process.env.ATLAS_ALLOW_DEMO_SEED !== "true") {
  fail("Recusado em Vercel production sem ATLAS_ALLOW_DEMO_SEED=true.");
}

console.log("============================================================");
console.log(" Atlas da Hemodinâmica — seed FICTÍCIO");
console.log(" Modo:", mode);
console.log("============================================================");
console.log("");
console.log("AVISO: estes dados NÃO são oficiais. Domínio example.com.");
console.log("NÃO misture com a base GOLDEN/oficial.");
console.log("");
console.log("Pré-requisito: aplicar migrations 007–011 no SQL Editor.");
console.log("");
console.log("Execute MANUALMENTE no Supabase SQL Editor (homologação), nesta ordem:");
console.log("");

for (const rel of files) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) fail(`Arquivo ausente: ${rel}`);
  const sql = fs.readFileSync(abs, "utf8");
  if (!sql.includes("DADO FICTÍCIO") && mode === "apply") {
    fail(`Seed sem marcação DADO FICTÍCIO: ${rel}`);
  }
  if (mode === "clear" && !sql.toLowerCase().includes("is_demo")) {
    fail(`Clear deve filtrar is_demo: ${rel}`);
  }
  console.log(`  → ${rel}  (${sql.length} bytes)`);
}

console.log("");
console.log("Depois valide com:");
console.log("  → supabase/checks/verify_phase_ac.sql");
console.log("");
console.log("Este script NÃO envia SQL ao banco remoto (segurança).");
console.log("============================================================");
