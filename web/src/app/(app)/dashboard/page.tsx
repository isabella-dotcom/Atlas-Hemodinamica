import { StatCard } from "@/components/stat-card";
import { getDashboardStats } from "@/lib/data";

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
          Dashboard
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Indicadores do piloto em Minas Gerais. Importações nunca aprovam
          automaticamente.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Médicos candidatos" value={stats.candidatos} />
        <StatCard label="Médicos validados" value={stats.validados} />
        <StatCard label="CRMs confirmados" value={stats.crmsConfirmados} />
        <StatCard label="RQEs confirmados" value={stats.rqesConfirmados} />
        <StatCard
          label="Estabelecimentos com hemodinâmica"
          value={stats.estabelecimentosHemo}
        />
        <StatCard
          label="Contatos disponíveis"
          value={stats.contatosDisponiveis}
        />
        <StatCard
          label="Pendências de validação"
          value={stats.pendenciasValidacao}
        />
      </div>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <h3 className="text-sm font-medium text-[var(--ink)]">
          Distribuição por estado
        </h3>
        {stats.porEstado.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">
            Sem dados ainda. Configure o Supabase e importe os primeiros
            estabelecimentos de MG.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-[var(--border)]">
            {stats.porEstado.map((row) => (
              <li
                key={row.state_uf}
                className="flex items-center justify-between py-2 text-sm"
              >
                <span className="text-[var(--ink-soft)]">{row.state_uf}</span>
                <span className="tabular-nums text-[var(--ink)]">
                  {row.total}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
