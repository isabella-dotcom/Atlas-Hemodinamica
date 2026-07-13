import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ReviewActions } from "./review-actions";
import type { Doctor, ReviewQueueItem } from "@/types/database";

type ReviewRow = ReviewQueueItem & {
  doctors: Pick<
    Doctor,
    "id" | "full_name" | "city" | "state_uf" | "confidence_score" | "classification"
  > | null;
};

export default async function ValidacaoPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("review_queue")
    .select(
      "*, doctors(id, full_name, city, state_uf, confidence_score, classification)",
    )
    .in("status", ["pendente", "em_analise", "nova_revisao"])
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(40);

  const items = (data ?? []) as ReviewRow[];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
          Fila de validação
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          A decisão final é humana. A pontuação de confiança apenas apoia a
          análise.
        </p>
      </div>

      {error ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Não foi possível carregar a fila. Verifique o Supabase.
        </p>
      ) : null}

      <div className="space-y-3">
        {items.length === 0 ? (
          <p className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-center text-sm text-[var(--muted)]">
            Nenhuma pendência no momento.
          </p>
        ) : (
          items.map((item) => (
            <article
              key={item.id}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                    {item.status.replaceAll("_", " ")} · prioridade{" "}
                    {item.priority}
                  </p>
                  {item.doctors ? (
                    <Link
                      href={`/medicos/${item.doctors.id}`}
                      className="mt-1 block font-medium text-[var(--accent)] hover:underline"
                    >
                      {item.doctors.full_name}
                    </Link>
                  ) : (
                    <p className="mt-1 font-medium">Item sem médico vinculado</p>
                  )}
                  <p className="mt-1 text-sm text-[var(--ink-soft)]">
                    {[item.doctors?.city, item.doctors?.state_uf]
                      .filter(Boolean)
                      .join("/") || "Local não informado"}
                    {item.doctors
                      ? ` · confiança ${item.doctors.confidence_score}%`
                      : ""}
                  </p>
                  {item.notes ? (
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      {item.notes}
                    </p>
                  ) : null}
                </div>
                <ReviewActions reviewId={item.id} doctorId={item.doctor_id} />
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
