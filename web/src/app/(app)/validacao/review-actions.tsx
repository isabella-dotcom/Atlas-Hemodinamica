"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function ReviewActions({
  reviewId,
  doctorId,
}: {
  reviewId: string;
  doctorId: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(
    decision: "aprovado" | "rejeitado" | "nova_revisao",
  ) {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error: reviewError } = await supabase
      .from("review_queue")
      .update({
        status: decision,
        decided_by: user?.id ?? null,
        decided_at: new Date().toISOString(),
      })
      .eq("id", reviewId);

    if (reviewError) {
      setError(reviewError.message);
      setBusy(false);
      return;
    }

    if (doctorId && decision === "aprovado") {
      await supabase
        .from("doctors")
        .update({
          layer: "oficial",
          classification: "atuacao_institucional_confirmada",
          last_validated_at: new Date().toISOString(),
          last_validated_by: user?.id ?? null,
          confidence_score: 80,
        })
        .eq("id", doctorId);
    }

    if (doctorId && decision === "rejeitado") {
      await supabase
        .from("doctors")
        .update({
          classification: "rejeitado",
          last_validated_at: new Date().toISOString(),
          last_validated_by: user?.id ?? null,
        })
        .eq("id", doctorId);
    }

    await supabase.from("audit_logs").insert({
      actor_id: user?.id ?? null,
      action: `review_${decision}`,
      entity_type: "review_queue",
      entity_id: reviewId,
      metadata: { doctor_id: doctorId },
    });

    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => decide("aprovado")}
          className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
        >
          Aprovar
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => decide("nova_revisao")}
          className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs disabled:opacity-60"
        >
          Nova revisão
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => decide("rejeitado")}
          className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs text-rose-800 disabled:opacity-60"
        >
          Rejeitar
        </button>
      </div>
      {error ? <p className="text-xs text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}
