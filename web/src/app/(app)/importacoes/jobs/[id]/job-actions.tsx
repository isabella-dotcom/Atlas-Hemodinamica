"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  cancelIngestionJobAction,
  requeueIngestionJobAction,
} from "@/services/ingestion/mutations";
import { useToast } from "@/components/ui/toast";

export function JobActions({ jobId, status }: { jobId: string; status: string }) {
  const router = useRouter();
  const { push } = useToast();
  const [pending, startTransition] = useTransition();

  function run(
    action: () => Promise<{ success: boolean; error?: { message: string } }>,
    ok: string,
  ) {
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        push(result.error?.message ?? "Falha", "error");
        return;
      }
      push(ok, "success");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {!["completed", "cancelled", "failed"].includes(status) ? (
        <button
          type="button"
          disabled={pending}
          className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
          onClick={() => run(() => cancelIngestionJobAction(jobId), "Job cancelado.")}
        >
          Cancelar
        </button>
      ) : null}
      <button
        type="button"
        disabled={pending}
        className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
        onClick={() => run(() => requeueIngestionJobAction(jobId), "Reprocessamento enfileirado.")}
      >
        Reprocessar
      </button>
      <Link
        href="/validacao"
        className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
      >
        Abrir fila
      </Link>
    </div>
  );
}
