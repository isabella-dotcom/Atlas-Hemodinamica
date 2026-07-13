import { createClient } from "@/lib/supabase/server";
import type { DataSource } from "@/types/database";

export default async function FontesPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("data_sources")
    .select("*")
    .order("reliability_score", { ascending: false });

  const sources = (data ?? []) as DataSource[];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
          Fontes e evidências
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Toda informação precisa de origem, data de coleta e responsável pela
          validação.
        </p>
      </div>

      {error ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Não foi possível carregar fontes.
        </p>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--border)] bg-[var(--surface-2)] text-xs uppercase tracking-wide text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">Código</th>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">Confiabilidade</th>
              <th className="px-4 py-3 font-medium">Descrição</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => (
              <tr
                key={source.id}
                className="border-b border-[var(--border)] last:border-0"
              >
                <td className="px-4 py-3 font-mono text-xs">{source.code}</td>
                <td className="px-4 py-3 font-medium">{source.name}</td>
                <td className="px-4 py-3 tabular-nums">
                  {source.reliability_score}%
                </td>
                <td className="px-4 py-3 text-[var(--muted)]">
                  {source.description || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
