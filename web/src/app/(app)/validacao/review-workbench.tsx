"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  claimReviewAction,
  decideReviewAction,
  releaseReviewAction,
} from "@/services/review/mutations";
import { useToast } from "@/components/ui/toast";
import type { ReviewStatus } from "@/types/database";

export function ReviewWorkbench({
  reviewId,
  doctorId,
  status,
}: {
  reviewId: string;
  doctorId: string | null;
  status: ReviewStatus;
}) {
  const router = useRouter();
  const { push } = useToast();
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const decided = status === "aprovado" || status === "rejeitado";

  function run(
    action: () => Promise<{ success: boolean; error?: { message: string } }>,
    okMsg: string,
  ) {
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        push(result.error?.message ?? "Falha na operação.", "error");
        return;
      }
      push(okMsg, "success");
      router.refresh();
    });
  }

  if (decided) {
    return <p className="text-xs text-[var(--muted)]">Decisão já registrada.</p>;
  }

  return (
    <div className="flex min-w-[220px] flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          disabled={pending}
          className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs disabled:opacity-60"
          onClick={() => run(() => claimReviewAction(reviewId), "Revisão assumida.")}
        >
          Assumir
        </button>
        <button
          type="button"
          disabled={pending}
          className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs disabled:opacity-60"
          onClick={() => run(() => releaseReviewAction(reviewId), "Revisão liberada.")}
        >
          Liberar
        </button>
        <button
          type="button"
          disabled={pending}
          className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs text-white disabled:opacity-60"
          onClick={() =>
            run(
              () =>
                decideReviewAction({
                  reviewId,
                  decision: "aprovado",
                }),
              "Validação concluída com sucesso.",
            )
          }
        >
          Aprovar
        </button>
        <button
          type="button"
          disabled={pending}
          className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs disabled:opacity-60"
          onClick={() =>
            run(
              () =>
                decideReviewAction({
                  reviewId,
                  decision: "nova_revisao",
                  reason: reason || "Solicitar mais informações",
                }),
              "Solicitada nova revisão.",
            )
          }
        >
          Mais info
        </button>
        <button
          type="button"
          disabled={pending || !reason.trim()}
          className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs text-rose-800 disabled:opacity-60"
          onClick={() =>
            run(
              () =>
                decideReviewAction({
                  reviewId,
                  decision: "rejeitado",
                  reason,
                }),
              "Candidato rejeitado.",
            )
          }
        >
          Rejeitar
        </button>
      </div>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Motivo (obrigatório para rejeitar)"
        className="w-full rounded-md border border-[var(--border)] px-2 py-1.5 text-xs"
      />
      {doctorId ? (
        <a href={`/medicos/${doctorId}`} className="text-xs text-[var(--accent)] hover:underline">
          Editar candidato
        </a>
      ) : null}
    </div>
  );
}
