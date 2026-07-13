import Link from "next/link";
import { redirect } from "next/navigation";
import { ReviewBadge } from "@/components/badges";
import { PageHeader, EmptyState, ErrorState } from "@/components/ui/page";
import { getCurrentProfile } from "@/lib/data";
import { canWrite } from "@/lib/permissions";
import { listReviewQueue } from "@/services/dashboard/queries";
import { ReviewWorkbench } from "./review-workbench";

type SearchParams = Promise<{ status?: string }>;

export default async function ValidacaoPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const profile = await getCurrentProfile();
  if (!canWrite(profile?.role)) redirect("/acesso-negado");

  const params = await searchParams;
  const result = await listReviewQueue({ status: params.status });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fila de validação"
        description="A decisão final é humana. A pontuação apenas apoia a análise."
        breadcrumbs={[{ label: "Validação" }]}
      />

      <form className="flex flex-wrap gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
        <select
          name="status"
          defaultValue={params.status ?? ""}
          className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
        >
          <option value="">Pendentes / em análise</option>
          <option value="pendente">Pendente</option>
          <option value="em_analise">Em análise</option>
          <option value="nova_revisao">Nova revisão</option>
          <option value="aprovado">Aprovado</option>
          <option value="rejeitado">Rejeitado</option>
        </select>
        <button type="submit" className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm text-white">
          Filtrar
        </button>
      </form>

      {!result.success ? (
        <ErrorState message={result.error.message} />
      ) : result.data.length === 0 ? (
        <EmptyState title="Nenhuma pendência no momento." />
      ) : (
        <div className="space-y-3">
          {result.data.map((item) => (
            <article
              key={item.id}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <ReviewBadge value={item.status} />
                    <span className="text-xs text-[var(--muted)]">
                      prioridade {item.priority} · {item.origin || "manual"}
                    </span>
                  </div>
                  {item.doctors ? (
                    <Link
                      href={`/medicos/${item.doctors.id}`}
                      className="mt-2 block font-medium text-[var(--accent)] hover:underline"
                    >
                      {item.doctors.full_name}
                    </Link>
                  ) : (
                    <p className="mt-2 font-medium">Item sem médico</p>
                  )}
                  <p className="mt-1 text-sm text-[var(--ink-soft)]">
                    {[item.doctors?.city, item.doctors?.state_uf]
                      .filter(Boolean)
                      .join("/") || "Local não informado"}
                    {item.doctors
                      ? ` · confiança ${item.doctors.confidence_score}%`
                      : ""}
                  </p>
                  {item.reason || item.notes ? (
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      {item.reason || item.notes}
                    </p>
                  ) : null}
                </div>
                <ReviewWorkbench
                  reviewId={item.id}
                  doctorId={item.doctor_id}
                  status={item.status}
                />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
