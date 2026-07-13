import Link from "next/link";
import {
  ButtonLink,
  EmptyState,
  ErrorState,
  PageHeader,
  PermissionGuard,
} from "@/components/ui/page";
import { Pagination } from "@/components/ui/pagination";
import { ConfidenceBadge, LayerBadge } from "@/components/badges";
import { getCurrentProfile } from "@/lib/data";
import { canWrite } from "@/lib/permissions";
import { searchFacilities } from "@/services/facilities/queries";

type SearchParams = Promise<Record<string, string | undefined>>;

export default async function EstabelecimentosPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const [profile, result] = await Promise.all([
    getCurrentProfile(),
    searchFacilities(params),
  ]);
  const writable = canWrite(profile?.role);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Estabelecimentos"
        description="A pesquisa começa pelos serviços de hemodinâmica."
        breadcrumbs={[{ label: "Estabelecimentos" }]}
        actions={
          <PermissionGuard allowed={writable}>
            <ButtonLink href="/estabelecimentos/novo">Novo estabelecimento</ButtonLink>
          </PermissionGuard>
        }
      />

      <form className="grid gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 md:grid-cols-4">
        <input name="q" defaultValue={params.q} placeholder="Nome" className="rounded-md border border-[var(--border)] px-3 py-2 text-sm" />
        <input name="cnes" defaultValue={params.cnes} placeholder="CNES" className="rounded-md border border-[var(--border)] px-3 py-2 text-sm" />
        <input name="city" defaultValue={params.city} placeholder="Cidade" className="rounded-md border border-[var(--border)] px-3 py-2 text-sm" />
        <input name="uf" defaultValue={params.uf ?? "MG"} placeholder="UF" maxLength={2} className="rounded-md border border-[var(--border)] px-3 py-2 text-sm uppercase" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="hemo" value="1" defaultChecked={params.hemo === "1"} />
          Com hemodinâmica
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="sus" value="1" defaultChecked={params.sus === "1"} />
          Atende SUS
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="withoutDoctors" value="1" defaultChecked={params.withoutDoctors === "1"} />
          Sem médicos
        </label>
        <button type="submit" className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm text-white">
          Filtrar
        </button>
      </form>

      {!result.success ? (
        <ErrorState message={result.error.message} />
      ) : result.data.rows.length === 0 ? (
        <EmptyState
          title="Nenhum estabelecimento encontrado"
          action={writable ? <ButtonLink href="/estabelecimentos/novo">Cadastrar</ButtonLink> : null}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)]">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--surface-2)] text-xs uppercase text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">CNES</th>
                <th className="px-4 py-3">Local</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">SUS</th>
                <th className="px-4 py-3">Hemo</th>
                <th className="px-4 py-3">Camada</th>
                <th className="px-4 py-3">Confiança</th>
              </tr>
            </thead>
            <tbody>
              {result.data.rows.map((facility) => (
                <tr key={facility.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/estabelecimentos/${facility.id}`} className="font-medium text-[var(--accent)] hover:underline">
                      {facility.trade_name || facility.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{facility.cnes || "—"}</td>
                  <td className="px-4 py-3">{facility.city}/{facility.state_uf}</td>
                  <td className="px-4 py-3">{facility.facility_type || "—"}</td>
                  <td className="px-4 py-3">
                    {facility.attends_sus == null ? "—" : facility.attends_sus ? "Sim" : "Não"}
                  </td>
                  <td className="px-4 py-3">{facility.has_hemodynamics ? "Sim" : "Não"}</td>
                  <td className="px-4 py-3">
                    <LayerBadge value={facility.layer} />
                  </td>
                  <td className="px-4 py-3">
                    <ConfidenceBadge score={facility.confidence_score} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 pb-4">
            <Pagination
              page={result.data.page}
              pageSize={result.data.pageSize}
              total={result.data.total}
              basePath="/estabelecimentos"
              searchParams={params}
            />
          </div>
        </div>
      )}
    </div>
  );
}
