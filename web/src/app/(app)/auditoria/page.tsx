import { redirect } from "next/navigation";
import { PageHeader, EmptyState, ErrorState } from "@/components/ui/page";
import { Pagination } from "@/components/ui/pagination";
import { getCurrentProfile } from "@/lib/data";
import { canViewAudit, isMaster } from "@/lib/permissions";
import { listAuditLogs } from "@/services/dashboard/queries";
import { AuditDetail } from "./audit-detail";

type SearchParams = Promise<{
  action?: string;
  entityType?: string;
  page?: string;
}>;

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const profile = await getCurrentProfile();
  if (!canViewAudit(profile?.role)) redirect("/acesso-negado");

  const params = await searchParams;
  const page = Number(params.page ?? "1") || 1;
  const result = await listAuditLogs({
    action: params.action,
    entityType: params.entityType,
    page,
    pageSize: 20,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Auditoria"
        description={
          isMaster(profile?.role)
            ? "Acesso completo aos eventos."
            : "Você visualiza apenas os próprios eventos (policy RLS)."
        }
        breadcrumbs={[{ label: "Auditoria" }]}
      />

      <form className="grid gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 md:grid-cols-3">
        <input
          name="action"
          defaultValue={params.action}
          placeholder="Ação"
          className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
        />
        <input
          name="entityType"
          defaultValue={params.entityType}
          placeholder="Entidade"
          className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm text-white">
          Filtrar
        </button>
      </form>

      {!result.success ? (
        <ErrorState message={result.error.message} />
      ) : result.data.rows.length === 0 ? (
        <EmptyState title="Nenhum evento encontrado." />
      ) : (
        <div className="space-y-3">
          {result.data.rows.map((row) => (
            <AuditDetail key={row.id} row={row} />
          ))}
          <Pagination
            page={page}
            pageSize={20}
            total={result.data.total}
            basePath="/auditoria"
            searchParams={params}
          />
        </div>
      )}
    </div>
  );
}
