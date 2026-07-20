"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  cancelImportAction,
  confirmImportAction,
  reprocessImportAction,
} from "@/services/imports/mutations";
import { useToast } from "@/components/ui/toast";

export function BatchActions({
  batchId,
  status,
  errors,
}: {
  batchId: string;
  status: string;
  errors: Array<{
    row_number: number | null;
    error_message: string | null;
    match_status: string | null;
  }>;
}) {
  const router = useRouter();
  const { push } = useToast();
  const [pending, startTransition] = useTransition();

  function downloadErrors() {
    const lines = [
      "row_number,match_status,error_message",
      ...errors.map(
        (e) =>
          `${e.row_number ?? ""},${e.match_status ?? ""},"${(e.error_message ?? "").replace(/"/g, '""')}"`,
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `erros_lote_${batchId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function run(
    action: () => Promise<{ success: boolean; error?: { message: string } }>,
    okMsg: string,
  ) {
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        push(result.error?.message ?? "Falha", "error");
        return;
      }
      push(okMsg, "success");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status === "preview" || status === "erro" ? (
        <button
          type="button"
          disabled={pending}
          className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm text-white"
          onClick={() => run(() => confirmImportAction(batchId), "Candidatos gerados.")}
        >
          Confirmar importação
        </button>
      ) : null}
      {status !== "cancelado" ? (
        <button
          type="button"
          disabled={pending}
          className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
          onClick={() => run(() => cancelImportAction(batchId), "Lote cancelado.")}
        >
          Cancelar
        </button>
      ) : null}
      <button
        type="button"
        disabled={pending}
        className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
        onClick={() =>
          run(() => reprocessImportAction(batchId), "Reprocessamento iniciado.")
        }
      >
        Reprocessar
      </button>
      <button
        type="button"
        className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
        onClick={downloadErrors}
      >
        Baixar erros
      </button>
    </div>
  );
}
