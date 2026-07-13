"use client";

import { useState } from "react";
import type { DiagnosticReport } from "@/lib/diagnostics";

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
        setError("Não foi possível executar o diagnóstico.");
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
          Informações técnicas não sensíveis para validar a fundação.
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
        <Item label="Versão da aplicação" value={report.appVersion} />
        <Item
          label="Verificado em"
          value={new Date(report.checkedAt).toLocaleString("pt-BR")}
        />
        <Item
          label="Supabase configurado"
          value={report.supabaseConfigured ? "disponível" : "indisponível"}
        />
        <Item
          label="Usuário autenticado"
          value={report.authenticated ? "sim" : "não"}
        />
        <Item
          label="Perfil encontrado"
          value={report.profileFound ? "sim" : "não"}
        />
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
          label="Acesso ao banco (leitura)"
          value={report.databaseReadable ? "ok" : "falhou"}
        />
        <Item
          label="Bucket evidences"
          value={report.buckets.evidences}
        />
        <Item label="Bucket imports" value={report.buckets.imports} />
      </dl>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <h3 className="text-sm font-medium text-[var(--ink)]">
          Migrations esperadas
        </h3>
        <ul className="mt-2 list-inside list-disc text-sm text-[var(--ink-soft)]">
          {report.expectedMigrations.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-[var(--muted)]">
          A aplicação não lê o histórico remoto de migrations; confira no SQL
          Editor se foram aplicadas na ordem.
        </p>
      </section>

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
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-[var(--ink)]">{value}</dd>
    </div>
  );
}
