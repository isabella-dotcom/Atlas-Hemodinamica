import Link from "next/link";
import {
  ClassificationBadge,
  ConfidenceBadge,
  ValidationBadge,
} from "@/components/badges";
import {
  ButtonLink,
  EmptyState,
  ErrorState,
  PageHeader,
  PermissionGuard,
} from "@/components/ui/page";
import { Pagination } from "@/components/ui/pagination";
import { getCurrentProfile } from "@/lib/data";
import { canWrite, isMaster } from "@/lib/permissions";
import { searchDoctors } from "@/services/doctors/queries";
import { listSpecialties } from "@/services/doctors/queries";
import { listFacilitiesForSelect } from "@/services/facilities/queries";

type SearchParams = Promise<Record<string, string | undefined>>;

export default async function MedicosPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const [profile, result, specialties, facilities] = await Promise.all([
    getCurrentProfile(),
    searchDoctors(params),
    listSpecialties(),
    listFacilitiesForSelect(),
  ]);

  const writable = canWrite(profile?.role);
  const master = isMaster(profile?.role);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Buscar médicos"
        description="Nome não é identificador único. Use CRM+UF, vínculos e evidências."
        breadcrumbs={[{ label: "Médicos" }]}
        actions={
          <PermissionGuard allowed={writable}>
            <ButtonLink href="/medicos/novo">Novo médico</ButtonLink>
          </PermissionGuard>
        }
      />

      <form className="grid gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 md:grid-cols-3 xl:grid-cols-4">
        <input name="search" defaultValue={params.search} placeholder="Busca livre" className="rounded-md border border-[var(--border)] px-3 py-2 text-sm" />
        <input name="state" defaultValue={params.state} placeholder="UF" maxLength={2} className="rounded-md border border-[var(--border)] px-3 py-2 text-sm uppercase" />
        <input name="city" defaultValue={params.city} placeholder="Cidade" className="rounded-md border border-[var(--border)] px-3 py-2 text-sm" />
        <select name="facility" defaultValue={params.facility ?? ""} className="rounded-md border border-[var(--border)] px-3 py-2 text-sm">
          <option value="">Estabelecimento</option>
          {facilities.success
            ? facilities.data.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))
            : null}
        </select>
        <select name="specialty" defaultValue={params.specialty ?? ""} className="rounded-md border border-[var(--border)] px-3 py-2 text-sm">
          <option value="">Especialidade</option>
          {specialties.success
            ? specialties.data.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))
            : null}
        </select>
        <select name="status" defaultValue={params.status ?? ""} className="rounded-md border border-[var(--border)] px-3 py-2 text-sm">
          <option value="">Classificação</option>
          <option value="possivel_candidato">Possível candidato</option>
          <option value="atuacao_provavel">Atuação provável</option>
          <option value="atuacao_institucional_confirmada">Atuação institucional</option>
          <option value="especialista_confirmado">Especialista confirmado</option>
          <option value="rejeitado">Rejeitado</option>
          <option value="inativo">Inativo</option>
        </select>
        <select name="validationStatus" defaultValue={params.validationStatus ?? ""} className="rounded-md border border-[var(--border)] px-3 py-2 text-sm">
          <option value="">Validação</option>
          <option value="nao_iniciada">Não iniciada</option>
          <option value="em_revisao">Em revisão</option>
          <option value="parcialmente_validada">Parcialmente validada</option>
          <option value="validada">Validada</option>
          <option value="rejeitada">Rejeitada</option>
        </select>
        <select name="hasRqe" defaultValue={params.hasRqe ?? ""} className="rounded-md border border-[var(--border)] px-3 py-2 text-sm">
          <option value="">RQE</option>
          <option value="1">Possui RQE</option>
          <option value="0">Sem RQE</option>
        </select>
        <select name="hasContact" defaultValue={params.hasContact ?? ""} className="rounded-md border border-[var(--border)] px-3 py-2 text-sm">
          <option value="">Contato</option>
          <option value="1">Com contato</option>
          <option value="0">Sem contato</option>
        </select>
        <input name="confidenceMin" defaultValue={params.confidenceMin} placeholder="Confiança mín." className="rounded-md border border-[var(--border)] px-3 py-2 text-sm" />
        <input name="confidenceMax" defaultValue={params.confidenceMax} placeholder="Confiança máx." className="rounded-md border border-[var(--border)] px-3 py-2 text-sm" />
        <select name="sort" defaultValue={params.sort ?? "updated_at"} className="rounded-md border border-[var(--border)] px-3 py-2 text-sm">
          <option value="updated_at">Atualização</option>
          <option value="name">Nome</option>
          <option value="confidence">Confiança</option>
          <option value="created_at">Criação</option>
          <option value="last_validated_at">Última validação</option>
          <option value="links">Vínculos</option>
        </select>
        <select name="pageSize" defaultValue={params.pageSize ?? "20"} className="rounded-md border border-[var(--border)] px-3 py-2 text-sm">
          <option value="10">10</option>
          <option value="20">20</option>
          <option value="50">50</option>
          <option value="100">100</option>
        </select>
        {master ? (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="archived" value="1" defaultChecked={params.archived === "1"} />
            Incluir arquivados
          </label>
        ) : null}
        <button type="submit" className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white">
          Filtrar
        </button>
      </form>

      {!result.success ? (
        <ErrorState message={result.error.message} />
      ) : result.data.rows.length === 0 ? (
        <EmptyState
          title="Nenhum médico encontrado"
          description="Ajuste os filtros ou cadastre um candidato."
          action={
            writable ? <ButtonLink href="/medicos/novo">Novo médico</ButtonLink> : null
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)]">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--surface-2)] text-xs uppercase tracking-wide text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">CRM</th>
                <th className="px-4 py-3">RQE</th>
                <th className="px-4 py-3">Especialidade</th>
                <th className="px-4 py-3">Local</th>
                <th className="px-4 py-3">Estabelecimento</th>
                <th className="px-4 py-3">Vínculos</th>
                <th className="px-4 py-3">Contato</th>
                <th className="px-4 py-3">Confiança</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Validação</th>
              </tr>
            </thead>
            <tbody>
              {result.data.rows.map((doctor) => (
                <tr key={doctor.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)]/50">
                  <td className="px-4 py-3">
                    <Link href={`/medicos/${doctor.id}`} className="font-medium text-[var(--accent)] hover:underline">
                      {doctor.full_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {doctor.primary_crm
                      ? `${doctor.primary_crm}/${doctor.primary_crm_uf ?? ""}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3">{doctor.primary_rqe || "—"}</td>
                  <td className="px-4 py-3">{doctor.primary_specialty || "—"}</td>
                  <td className="px-4 py-3">
                    {[doctor.city, doctor.state_uf].filter(Boolean).join("/") || "—"}
                  </td>
                  <td className="px-4 py-3">{doctor.primary_facility || "—"}</td>
                  <td className="px-4 py-3 tabular-nums">{doctor.links_count}</td>
                  <td className="px-4 py-3">{doctor.has_contact ? "Sim" : "Não"}</td>
                  <td className="px-4 py-3">
                    <ConfidenceBadge score={doctor.confidence_score} />
                  </td>
                  <td className="px-4 py-3">
                    <ClassificationBadge value={doctor.classification} />
                  </td>
                  <td className="px-4 py-3">
                    <ValidationBadge value={doctor.validation_status} />
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
              basePath="/medicos"
              searchParams={params}
            />
          </div>
        </div>
      )}
    </div>
  );
}
