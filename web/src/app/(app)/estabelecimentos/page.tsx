import Link from "next/link";
import { ConfidenceBar, LayerBadge } from "@/components/badges";
import { createClient } from "@/lib/supabase/server";
import type { HealthFacility } from "@/types/database";

type SearchParams = Promise<{ q?: string; uf?: string; hemo?: string }>;

export default async function EstabelecimentosPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("health_facilities")
    .select("*")
    .eq("is_deleted", false)
    .order("name")
    .limit(50);

  if (params.q) query = query.ilike("name", `%${params.q}%`);
  if (params.uf) query = query.eq("state_uf", params.uf.toUpperCase());
  if (params.hemo === "1") query = query.eq("has_hemodynamics", true);

  const { data, error } = await query;
  const facilities = (data ?? []) as HealthFacility[];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
            Estabelecimentos
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            A pesquisa começa pelos serviços de hemodinâmica.
          </p>
        </div>
        <Link
          href="/estabelecimentos/novo"
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Novo estabelecimento
        </Link>
      </div>

      <form className="grid gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 md:grid-cols-4">
        <input
          name="q"
          defaultValue={params.q}
          placeholder="Nome"
          className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
        />
        <input
          name="uf"
          defaultValue={params.uf ?? "MG"}
          placeholder="UF"
          maxLength={2}
          className="rounded-md border border-[var(--border)] px-3 py-2 text-sm uppercase"
        />
        <label className="flex items-center gap-2 text-sm text-[var(--ink-soft)]">
          <input
            type="checkbox"
            name="hemo"
            value="1"
            defaultChecked={params.hemo === "1"}
          />
          Com hemodinâmica
        </label>
        <button
          type="submit"
          className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm"
        >
          Filtrar
        </button>
      </form>

      {error ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Não foi possível carregar estabelecimentos. Aplique a migration no
          Supabase.
        </p>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--border)] bg-[var(--surface-2)] text-xs uppercase tracking-wide text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">Local</th>
              <th className="px-4 py-3 font-medium">CNES</th>
              <th className="px-4 py-3 font-medium">SUS</th>
              <th className="px-4 py-3 font-medium">Camada</th>
              <th className="px-4 py-3 font-medium">Confiança</th>
            </tr>
          </thead>
          <tbody>
            {facilities.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-[var(--muted)]"
                >
                  Nenhum estabelecimento encontrado.
                </td>
              </tr>
            ) : (
              facilities.map((facility) => (
                <tr
                  key={facility.id}
                  className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)]/60"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/estabelecimentos/${facility.id}`}
                      className="font-medium text-[var(--accent)] hover:underline"
                    >
                      {facility.name}
                    </Link>
                    {facility.has_hemodynamics ? (
                      <span className="ml-2 text-xs text-teal-700">Hemo</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-[var(--ink-soft)]">
                    {facility.city}/{facility.state_uf}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-[var(--ink-soft)]">
                    {facility.cnes || "—"}
                  </td>
                  <td className="px-4 py-3 text-[var(--ink-soft)]">
                    {facility.attends_sus == null
                      ? "—"
                      : facility.attends_sus
                        ? "Sim"
                        : "Não"}
                  </td>
                  <td className="px-4 py-3">
                    <LayerBadge value={facility.layer} />
                  </td>
                  <td className="px-4 py-3">
                    <ConfidenceBar score={facility.confidence_score} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
