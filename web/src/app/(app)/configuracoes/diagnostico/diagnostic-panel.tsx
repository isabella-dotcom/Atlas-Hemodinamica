"use client";

import { useState } from "react";
import type { CheckStatus, DiagnosticReport } from "@/lib/diagnostics";

export function DiagnosticPanel({
  initialReport,
}: {
  initialReport: DiagnosticReport;
}) {
  const [report, setReport] = useState(initialReport);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRun() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/diagnostico", { method: "POST" });
      if (!response.ok) {
        setError(
          response.status === 403
            ? "Sem permissão para executar diagnóstico."
            : "Não foi possível executar o diagnóstico.",
        );
        setBusy(false);
        return;
      }
      const data = (await response.json()) as DiagnosticReport;
      setReport(data);
    } catch {
      setError("Falha de rede ao executar o diagnóstico.");
    }
    setBusy(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--muted)]">
          Informações técnicas não sensíveis. Nenhum segredo é exibido.
        </p>
        <button
          type="button"
          onClick={handleRun}
          disabled={busy}
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {busy ? "Executando…" : "Executar diagnóstico"}
        </button>
      </div>

      {error ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      <dl className="grid gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 sm:grid-cols-2">
        <Item label="Ambiente" value={report.environment} />
        <Item label="Versão" value={report.appVersion} />
        <Item
          label="Verificado em"
          value={new Date(report.checkedAt).toLocaleString("pt-BR")}
        />
        <Item
          label="Supabase"
          value={report.supabaseConfigured ? "Conectado (configurado)" : "Erro de configuração"}
          tone={report.supabaseConfigured ? "ok" : "fail"}
        />
        <Item label="Autenticado" value={report.authenticated ? "sim" : "não"} />
        <Item label="Perfil" value={report.profileFound ? "encontrado" : "ausente"} />
        <Item label="Papel" value={report.role ?? "—"} />
        <Item
          label="Perfil ativo"
          value={
            report.profileActive == null
              ? "—"
              : report.profileActive
                ? "sim"
                : "não"
          }
        />
        <Item
          label="Leitura do banco"
          value={report.databaseReadable ? "ok" : "falhou"}
          tone={report.databaseReadable ? "ok" : "fail"}
        />
        <Item
          label="Schema Fase A–C"
          value={labelStatus(report.schemaPhaseAc)}
          tone={toneFromStatus(report.schemaPhaseAc)}
        />
        <Item
          label="Bucket evidences"
          value={labelStatus(report.buckets.evidences)}
          tone={toneFromStatus(report.buckets.evidences)}
        />
        <Item
          label="Bucket imports"
          value={labelStatus(report.buckets.imports)}
          tone={toneFromStatus(report.buckets.imports)}
        />
        <Item
          label="RPC search_doctors"
          value={labelStatus(report.rpcs.search_doctors)}
          tone={toneFromStatus(report.rpcs.search_doctors)}
        />
        <Item
          label="RPC explain_doctor_confidence"
          value={labelStatus(report.rpcs.explain_doctor_confidence)}
          tone={toneFromStatus(report.rpcs.explain_doctor_confidence)}
        />
        <Item
          label="RPC write_audit_log"
          value={labelStatus(report.rpcs.write_audit_log)}
          tone={toneFromStatus(report.rpcs.write_audit_log)}
        />
        <Item
          label="RPC diagnostic_foundation_check"
          value={labelStatus(report.rpcs.diagnostic_foundation_check)}
          tone={toneFromStatus(report.rpcs.diagnostic_foundation_check)}
        />
        <Item
          label="RPC diagnostic_phase_ac_check"
          value={labelStatus(report.rpcs.diagnostic_phase_ac_check)}
          tone={toneFromStatus(report.rpcs.diagnostic_phase_ac_check)}
        />
        <Item
          label="Médicos demo (is_demo)"
          value={
            report.demoCounts.doctors == null
              ? "—"
              : String(report.demoCounts.doctors)
          }
        />
        <Item
          label="Estabelecimentos demo"
          value={
            report.demoCounts.facilities == null
              ? "—"
              : String(report.demoCounts.facilities)
          }
        />
      </dl>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <h3 className="text-sm font-medium">Migrations esperadas</h3>
        <ul className="mt-2 list-inside list-disc text-sm text-[var(--ink-soft)]">
          {report.expectedMigrations.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-[var(--muted)]">
          Confirme no SQL Editor se foram aplicadas na ordem. Se o schema Fase A–C
          estiver vermelho, aplique 007–011 e rode supabase/checks/verify_phase_ac.sql.
        </p>
      </section>

      {report.schemaDetails ? (
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <h3 className="text-sm font-medium">Detalhe schema Fase A–C (RPC Master)</h3>
          <pre className="mt-3 overflow-auto rounded-md bg-[var(--surface-2)] p-3 text-xs">
            {JSON.stringify(report.schemaDetails, null, 2)}
          </pre>
        </section>
      ) : null}

      {report.foundation ? (
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <h3 className="text-sm font-medium">Fundação (RPC Master)</h3>
          <pre className="mt-3 overflow-auto rounded-md bg-[var(--surface-2)] p-3 text-xs">
            {JSON.stringify(report.foundation, null, 2)}
          </pre>
        </section>
      ) : null}

      {report.notes.length > 0 ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-5">
          <h3 className="text-sm font-medium text-amber-950">Observações</h3>
          <ul className="mt-2 list-inside list-disc text-sm text-amber-900">
            {report.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {report.guidance.length > 0 ? (
        <section className="rounded-lg border border-sky-200 bg-sky-50 p-5">
          <h3 className="text-sm font-medium text-sky-950">Orientações</h3>
          <ul className="mt-2 list-inside list-disc text-sm text-sky-900">
            {report.guidance.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function labelStatus(status: CheckStatus): string {
  switch (status) {
    case "ok":
      return "ok";
    case "partial":
      return "parcial / migration incompleta";
    case "fail":
      return "falhou / migration pendente";
    case "unavailable":
      return "indisponível";
    case "forbidden":
      return "sem permissão";
    case "unconfigured":
      return "não configurado";
    default:
      return "desconhecido";
  }
}

function toneFromStatus(status: CheckStatus): "ok" | "partial" | "fail" | undefined {
  if (status === "ok") return "ok";
  if (status === "partial") return "partial";
  if (status === "fail" || status === "unconfigured") return "fail";
  return undefined;
}

function Item({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok" | "partial" | "fail";
}) {
  const color =
    tone === "ok"
      ? "text-emerald-800"
      : tone === "partial"
        ? "text-amber-800"
        : tone === "fail"
          ? "text-rose-800"
          : "text-[var(--ink)]";
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</dt>
      <dd className={`mt-1 text-sm font-medium ${color}`}>{value}</dd>
    </div>
  );
}
