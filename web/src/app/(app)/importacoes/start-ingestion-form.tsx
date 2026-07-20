"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { enqueueIngestionJobAction } from "@/services/ingestion/mutations";
import { useToast } from "@/components/ui/toast";

export function StartIngestionForm() {
  const router = useRouter();
  const { push } = useToast();
  const [pending, startTransition] = useTransition();
  const [sourceCode, setSourceCode] = useState("CNES");
  const [stateUf, setStateUf] = useState("MG");
  const [competence, setCompetence] = useState("");
  const [fallbackUrl, setFallbackUrl] = useState("");
  const [discoverOnly, setDiscoverOnly] = useState(false);
  const [updateExisting, setUpdateExisting] = useState(true);

  function submit() {
    startTransition(async () => {
      const result = await enqueueIngestionJobAction({
        job_type: discoverOnly ? "discover_cnes" : "ingest_cnes",
        source_code: sourceCode,
        state_uf: stateUf,
        competence: competence || null,
        parameters: {
          fallback_url: fallbackUrl || null,
          discover_only: discoverOnly,
          update_existing: updateExisting,
          generate_candidates: !discoverOnly,
          modalities: ["ESTABELECIMENTOS", "PROFISSIONAIS", "SERVICOS", "EQUIPAMENTOS"],
        },
      });
      if (!result.success) {
        push(result.error.message, "error");
        return;
      }
      push(
        result.data.workflow_triggered
          ? "Job criado e workflow disparado."
          : "Job enfileirado — será processado no próximo schedule do GitHub Actions.",
        "success",
      );
      router.push(`/importacoes/jobs/${result.data.id}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
      <h3 className="text-sm font-medium">Nova ingestão automática</h3>
      <p className="text-xs text-[var(--muted)]">
        FONTES → DOWNLOAD → RAW → candidatos → fila. Nunca promove para oficial
        automaticamente.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-[var(--muted)]">Fonte</span>
          <select
            className="w-full rounded-md border border-[var(--border)] px-3 py-2"
            value={sourceCode}
            onChange={(e) => setSourceCode(e.target.value)}
          >
            <option value="CNES">CNES/DATASUS</option>
            <option value="OPENDATASUS">OpenDataSUS</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-[var(--muted)]">UF</span>
          <input
            className="w-full rounded-md border border-[var(--border)] px-3 py-2"
            maxLength={2}
            value={stateUf}
            onChange={(e) => setStateUf(e.target.value.toUpperCase())}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-[var(--muted)]">Competência</span>
          <input
            className="w-full rounded-md border border-[var(--border)] px-3 py-2"
            placeholder="2026-06"
            value={competence}
            onChange={(e) => setCompetence(e.target.value)}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-[var(--muted)]">URL oficial (fallback)</span>
          <input
            className="w-full rounded-md border border-[var(--border)] px-3 py-2"
            placeholder="https://ftp.datasus.gov.br/..."
            value={fallbackUrl}
            onChange={(e) => setFallbackUrl(e.target.value)}
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={discoverOnly}
          onChange={(e) => setDiscoverOnly(e.target.checked)}
        />
        Somente descobrir arquivos
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={updateExisting}
          onChange={(e) => setUpdateExisting(e.target.checked)}
        />
        Atualizar observações de registros existentes (respeita overrides)
      </label>
      <button
        type="button"
        disabled={pending}
        className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm text-white disabled:opacity-60"
        onClick={submit}
      >
        {pending ? "Enfileirando…" : "Iniciar ingestão"}
      </button>
    </div>
  );
}
