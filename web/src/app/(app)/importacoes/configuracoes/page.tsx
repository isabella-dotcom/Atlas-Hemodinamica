import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data";
import { canWrite } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page";

export default async function ImportacoesConfigPage() {
  const profile = await getCurrentProfile();
  if (!canWrite(profile?.role)) redirect("/acesso-negado");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configurações de ingestão"
        description="Parâmetros operacionais. Regras de pontuação e URLs oficiais ficam no repositório ETL."
        breadcrumbs={[
          { label: "Importações", href: "/importacoes" },
          { label: "Configurações" },
        ]}
      />
      <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 text-sm">
        <p>
          <strong>Catálogo de fontes:</strong> <code>etl/config/sources.yaml</code>
        </p>
        <p>
          <strong>Regras de hemodinâmica:</strong>{" "}
          <code>etl/config/hemodynamics_rules.yaml</code>
        </p>
        <p>
          <strong>CBO:</strong> <code>etl/config/cbo_rules.yaml</code>
        </p>
        <p>
          <strong>Worker:</strong> GitHub Actions + <code>etl/cli.py</code>. Secrets:{" "}
          <code>SUPABASE_URL</code>, <code>SUPABASE_SERVICE_ROLE_KEY</code>.
        </p>
        <p>
          <strong>Disparo imediato (opcional na Vercel):</strong>{" "}
          <code>GITHUB_ACTIONS_TOKEN</code>, <code>GITHUB_REPOSITORY</code>,{" "}
          <code>GITHUB_WORKFLOW_REF</code>. Sem token, o job permanece{" "}
          <code>queued</code> até o schedule.
        </p>
        <p className="text-[var(--muted)]">
          SIA/SIH e coleta institucional permanecem desativados por padrão. CFM/CRM: apenas
          validação assistida (sem scraping).
        </p>
      </div>
    </div>
  );
}
