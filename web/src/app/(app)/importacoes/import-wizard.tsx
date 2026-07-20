"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import {
  createImportPreviewAction,
  confirmImportAction,
  cancelImportAction,
} from "@/services/imports/mutations";
import {
  IMPORT_ENTITY_LABELS,
  IMPORT_ENTITY_TYPES,
  TEMPLATE_HEADERS,
  autoMapColumns,
  buildTemplateCsv,
  type ImportEntityType,
} from "@/services/imports/templates";
import { parseTabularFile, sha256Hex } from "@/services/imports/parse";

type SourceOption = { id: string; code: string; name: string };

export function ImportWizard({ sources }: { sources: SourceOption[] }) {
  const router = useRouter();
  const { push } = useToast();
  const [pending, startTransition] = useTransition();

  const [entityType, setEntityType] = useState<ImportEntityType>("doctors");
  const [sourceId, setSourceId] = useState(sources[0]?.id ?? "");
  const [competencia, setCompetencia] = useState("");
  const [stateUf, setStateUf] = useState("MG");
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [encoding, setEncoding] = useState("utf-8");
  const [delimiter, setDelimiter] = useState(",");
  const [hash, setHash] = useState("");
  const [batchId, setBatchId] = useState<string | null>(null);
  const [stats, setStats] = useState<{
    valid: number;
    invalid: number;
    duplicates: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const previewRows = useMemo(() => rows.slice(0, 20), [rows]);

  async function handleFile(selected: File | null) {
    setFile(selected);
    setBatchId(null);
    setStats(null);
    setError(null);
    if (!selected) {
      setHeaders([]);
      setRows([]);
      return;
    }
    try {
      const parsed = await parseTabularFile(selected);
      const digest = await sha256Hex(selected);
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setEncoding(parsed.encoding);
      setDelimiter(parsed.delimiter);
      setHash(digest);
      setMapping(autoMapColumns(parsed.headers, entityType));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao ler arquivo.");
    }
  }

  function downloadTemplate(entity: ImportEntityType) {
    const csv = buildTemplateCsv(entity);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `template_${entity}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function submitPreview() {
    if (!file || rows.length === 0) {
      setError("Selecione um arquivo com dados.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "csv";
      const path = `${user?.id ?? "anon"}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("imports")
        .upload(path, file);

      const result = await createImportPreviewAction({
        file_name: file.name,
        file_type: ext,
        file_hash: hash,
        entity_type: entityType,
        source_id: sourceId || null,
        competencia: competencia || null,
        state_uf: stateUf || null,
        encoding,
        delimiter,
        storage_path: uploadError ? null : path,
        column_mapping: mapping,
        headers,
        rows,
      });

      if (!result.success) {
        setError(result.error.message);
        push(result.error.message, "error");
        return;
      }
      setBatchId(result.data.id);
      setStats({
        valid: result.data.valid,
        invalid: result.data.invalid,
        duplicates: result.data.duplicates,
      });
      push("Prévia criada. Revise e confirme para gerar candidatos.", "success");
      router.refresh();
    });
  }

  function confirmBatch() {
    if (!batchId) return;
    startTransition(async () => {
      const result = await confirmImportAction(batchId);
      if (!result.success) {
        push(result.error.message, "error");
        return;
      }
      push(
        `Importação confirmada: ${result.data.candidates} candidatos gerados.`,
        "success",
      );
      router.push(`/importacoes/${batchId}`);
      router.refresh();
    });
  }

  function cancelBatch() {
    if (!batchId) return;
    startTransition(async () => {
      const result = await cancelImportAction(batchId);
      if (!result.success) {
        push(result.error.message, "error");
        return;
      }
      push("Lote cancelado.", "info");
      setBatchId(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <h3 className="text-sm font-medium">Templates (fictícios)</h3>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Baixe o modelo, preencha com dados obtidos legitimamente e envie. Não
          versionar arquivos reais no Git.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {IMPORT_ENTITY_TYPES.map((entity) => (
            <button
              key={entity}
              type="button"
              className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs hover:bg-[var(--surface-2)]"
              onClick={() => downloadTemplate(entity)}
            >
              {IMPORT_ENTITY_LABELS[entity]}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <h3 className="text-sm font-medium">Nova importação</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-[var(--muted)]">Entidade</span>
            <select
              className="w-full rounded-md border border-[var(--border)] px-3 py-2"
              value={entityType}
              onChange={(e) => {
                const next = e.target.value as ImportEntityType;
                setEntityType(next);
                if (headers.length) setMapping(autoMapColumns(headers, next));
              }}
            >
              {IMPORT_ENTITY_TYPES.map((entity) => (
                <option key={entity} value={entity}>
                  {IMPORT_ENTITY_LABELS[entity]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-[var(--muted)]">Fonte</span>
            <select
              className="w-full rounded-md border border-[var(--border)] px-3 py-2"
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
            >
              <option value="">—</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-[var(--muted)]">Competência</span>
            <input
              className="w-full rounded-md border border-[var(--border)] px-3 py-2"
              placeholder="2026-01"
              value={competencia}
              onChange={(e) => setCompetencia(e.target.value)}
            />
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
          <label className="text-sm md:col-span-2">
            <span className="mb-1 block text-[var(--muted)]">Arquivo CSV ou XLSX</span>
            <input
              type="file"
              accept=".csv,.txt,.xlsx,.xls"
              className="block w-full text-sm"
              onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        {headers.length > 0 ? (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Mapeamento de colunas</h4>
            <div className="grid gap-2 md:grid-cols-2">
              {TEMPLATE_HEADERS[entityType].map((target) => (
                <label key={target} className="text-xs">
                  <span className="mb-1 block text-[var(--muted)]">{target}</span>
                  <select
                    className="w-full rounded-md border border-[var(--border)] px-2 py-1.5"
                    value={mapping[target] ?? ""}
                    onChange={(e) =>
                      setMapping((prev) => ({ ...prev, [target]: e.target.value }))
                    }
                  >
                    <option value="">—</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>

            <h4 className="text-sm font-medium">
              Prévia ({previewRows.length} de {rows.length} linhas)
            </h4>
            <div className="overflow-auto rounded-md border border-[var(--border)]">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-[var(--surface-2)]">
                  <tr>
                    {headers.slice(0, 8).map((h) => (
                      <th key={h} className="px-2 py-1 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, idx) => (
                    <tr key={idx} className="border-t border-[var(--border)]">
                      {headers.slice(0, 8).map((h) => (
                        <td key={h} className="px-2 py-1 whitespace-nowrap">
                          {row[h]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending}
                className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm text-white disabled:opacity-60"
                onClick={submitPreview}
              >
                {pending ? "Processando…" : "Gerar prévia e validar"}
              </button>
            </div>
          </div>
        ) : null}

        {stats ? (
          <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-900">
            Lote {batchId}: {rows.length} linhas · {stats.valid} válidas ·{" "}
            {stats.invalid} inválidas · {stats.duplicates} duplicadas
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending}
                className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs text-white"
                onClick={confirmBatch}
              >
                Confirmar e gerar candidatos
              </button>
              <button
                type="button"
                disabled={pending}
                className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs text-rose-800"
                onClick={cancelBatch}
              >
                Cancelar lote
              </button>
              {batchId ? (
                <Link
                  href={`/importacoes/${batchId}`}
                  className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs"
                >
                  Ver detalhe
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}

        {error ? (
          <p className="text-sm text-rose-800" role="alert">
            {error}
          </p>
        ) : null}
        {hash ? (
          <p className="text-xs text-[var(--muted)]">SHA-256: {hash.slice(0, 16)}…</p>
        ) : null}
      </section>
    </div>
  );
}
