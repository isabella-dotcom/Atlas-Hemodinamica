import Link from "next/link";
import { StatCard } from "@/components/stat-card";
import { PageHeader, EmptyState, ButtonLink } from "@/components/ui/page";
import { getDashboardStats, getRecentAudit } from "@/services/dashboard/queries";
import { getCurrentProfile } from "@/lib/data";
import { canWrite } from "@/lib/permissions";

export default async function DashboardPage() {
  const [stats, auditResult, profile] = await Promise.all([
    getDashboardStats(),
    getRecentAudit(8),
    getCurrentProfile(),
  ]);
  const writable = canWrite(profile?.role);
  const empty = stats.totalMedicos === 0 && stats.estabelecimentosAtivos === 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Indicadores do MVP. Importações nunca aprovam automaticamente."
        breadcrumbs={[{ label: "Dashboard" }]}
        actions={
          writable ? (
            <>
              <ButtonLink href="/estabelecimentos/novo">Novo estabelecimento</ButtonLink>
              <ButtonLink href="/medicos/novo" variant="secondary">
                Novo médico
              </ButtonLink>
            </>
          ) : null
        }
      />

      {empty ? (
        <EmptyState
          title="Base ainda vazia"
          description="Comece cadastrando um estabelecimento com hemodinâmica e depois os médicos candidatos."
          action={
            writable ? (
              <div className="flex gap-2">
                <ButtonLink href="/estabelecimentos/novo">Cadastrar estabelecimento</ButtonLink>
                <ButtonLink href="/medicos/novo" variant="secondary">
                  Cadastrar médico
                </ButtonLink>
              </div>
            ) : undefined
          }
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Médicos ativos" value={stats.totalMedicos} />
        <StatCard label="Candidatos" value={stats.candidatos} />
        <StatCard label="Em revisão" value={stats.emRevisao} />
        <StatCard label="Parcialmente validados" value={stats.parcialmenteValidados} />
        <StatCard label="Validados" value={stats.validados} />
        <StatCard label="Especialistas confirmados" value={stats.especialistasConfirmados} />
        <StatCard label="Estabelecimentos ativos" value={stats.estabelecimentosAtivos} />
        <StatCard label="Com hemodinâmica" value={stats.estabelecimentosHemo} />
        <StatCard label="Vínculos ativos" value={stats.vinculosAtivos} />
        <StatCard label="Contatos disponíveis" value={stats.contatosDisponiveis} />
        <StatCard label="Evidências pendentes" value={stats.evidenciasPendentes} />
        <StatCard label="Fila de validação" value={stats.pendenciasValidacao} />
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <h3 className="text-sm font-medium text-[var(--ink)]">Pendências</h3>
          <ul className="mt-3 space-y-2 text-sm text-[var(--ink-soft)]">
            <Li label="Médicos sem CRM" value={stats.semCrm} />
            <Li label="Médicos sem vínculo" value={stats.semVinculo} />
            <Li label="Médicos sem evidência" value={stats.semEvidencia} />
            <Li label="Confiança abaixo de 60" value={stats.baixaConfianca} />
            <Li label="Vínculos sem validação recente" value={stats.vinculosSemValidacaoRecente} />
            <Li label="Hemo sem médicos vinculados" value={stats.hemoSemMedicos} />
          </ul>
        </div>

        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-[var(--ink)]">Atividade recente</h3>
            {canWrite(profile?.role) ? (
              <Link href="/auditoria" className="text-xs text-[var(--accent)] hover:underline">
                Ver auditoria
              </Link>
            ) : null}
          </div>
          {!auditResult.success || auditResult.data.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--muted)]">Nenhuma atividade registrada.</p>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--border)]">
              {auditResult.data.map((row) => (
                <li key={row.id} className="py-2 text-sm">
                  <p className="text-[var(--ink)]">{row.action}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {row.users_profile?.full_name ?? "Sistema"} · {row.entity_type}
                    {row.entity_id ? ` · ${row.entity_id.slice(0, 8)}` : ""} ·{" "}
                    {new Date(row.created_at).toLocaleString("pt-BR")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function Li({ label, value }: { label: string; value: number }) {
  return (
    <li className="flex items-center justify-between">
      <span>{label}</span>
      <span className="tabular-nums text-[var(--ink)]">{value}</span>
    </li>
  );
}
