"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function ImportUploadForm() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) {
      setError("Selecione um arquivo CSV, TXT, XLSX ou ZIP.");
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
    const path = `${user?.id ?? "anon"}/${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("imports")
      .upload(path, file);

    if (uploadError) {
      // Ainda registra o lote mesmo se o bucket não existir — útil no bootstrap
      setMessage(
        `Lote será registrado sem storage (${uploadError.message}). Configure o bucket "imports".`,
      );
    }

    const text = await file.text().catch(() => "");
    const lines = text
      ? text.split(/\r?\n/).filter((line) => line.trim().length > 0)
      : [];

    const { data: batch, error: batchError } = await supabase
      .from("import_batches")
      .insert({
        file_name: file.name,
        file_type: ext,
        storage_path: uploadError ? null : path,
        status: "preview",
        row_count: Math.max(lines.length - 1, 0),
        preview_summary: {
          headers: lines[0]?.split(/[;,]/).slice(0, 12) ?? [],
          sample_rows: lines.slice(1, 6),
          note: "Prévia bruta — confirmação humana obrigatória antes de gerar candidatos",
        },
        uploaded_by: user?.id ?? null,
      })
      .select("id")
      .single();

    if (batchError || !batch) {
      setError(batchError?.message ?? "Falha ao registrar lote.");
      setBusy(false);
      return;
    }

    const rawRows = lines.slice(1, 101).map((line, index) => ({
      batch_id: batch.id,
      row_number: index + 2,
      payload: { raw: line },
      match_status: "pendente",
    }));

    if (rawRows.length > 0) {
      await supabase.from("raw_records").insert(rawRows);
    }

    setMessage(
      `Lote criado em prévia (${rawRows.length} registros brutos amostrados). Use o ETL Python para normalizar e só então confirme.`,
    );
    setBusy(false);
    setFile(null);
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5"
    >
      <label className="mb-2 block text-sm text-[var(--ink-soft)]">
        Enviar CSV, TXT, Excel ou ZIP
      </label>
      <input
        type="file"
        accept=".csv,.txt,.xlsx,.xls,.zip"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="block w-full text-sm"
      />
      <button
        type="submit"
        disabled={busy}
        className="mt-4 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {busy ? "Enviando…" : "Gerar prévia bruta"}
      </button>
      {error ? (
        <p className="mt-3 text-sm text-[var(--danger)]">{error}</p>
      ) : null}
      {message ? (
        <p className="mt-3 text-sm text-teal-800">{message}</p>
      ) : null}
    </form>
  );
}
