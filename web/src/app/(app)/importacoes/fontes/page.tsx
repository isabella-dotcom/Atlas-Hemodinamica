import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "@/components/ui/page";

export default async function FontesIngestaoPage() {
  const supabase = await createClient();
  const { data: sources } = await supabase
    .from("data_sources")
    .select("*")
    .order("name");
  const { data: sync } = await supabase.from("sync_states").select("*");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fontes de ingestão"
        description="Catálogo operacional (Supabase). Detalhes de URLs oficiais em etl/config/sources.yaml."
        breadcrumbs={[
          { label: "Importações", href: "/importacoes" },
          { label: "Fontes" },
        ]}
      />
      {(sources ?? []).length === 0 ? (
        <EmptyState title="Nenhuma fonte" />
      ) : (
        <ul className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)] bg-[var(--surface)]">
          {(sources ?? []).map((s) => (
            <li key={s.id} className="px-4 py-3 text-sm">
              <p className="font-medium">
                {s.code} — {s.name} {s.is_active ? "" : "(inativa)"}
              </p>
              <p className="text-[var(--muted)]">{s.description}</p>
              {s.url ? (
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-[var(--accent)]"
                >
                  {s.url}
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <h3 className="mb-2 text-sm font-medium">Estados de sincronização</h3>
        {(sync ?? []).length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Nenhuma sincronização registrada.</p>
        ) : (
          <ul className="space-y-1 text-xs">
            {(sync ?? []).map((row) => (
              <li key={`${row.source_code}-${row.state_uf}`}>
                {row.source_code}/{row.state_uf}: processado {row.last_processed_competence || "—"} ·
                descoberto {row.last_discovered_competence || "—"}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
