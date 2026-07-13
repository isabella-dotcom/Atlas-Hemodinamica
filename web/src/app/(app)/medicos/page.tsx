import Link from "next/link";
import {
  ClassificationBadge,
  ConfidenceBar,
  LayerBadge,
} from "@/components/badges";
import { createClient, hasSupabaseEnv } from "@/lib/supabase/server";
import type { Doctor } from "@/types/database";

type SearchParams = Promise<{
  q?: string;
  uf?: string;
  status?: string;
}>;

export default async function MedicosPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  let doctors: Doctor[] = [];
  let error: { message: string } | null = null;

  if (hasSupabaseEnv()) {
    const supabase = await createClient();
    let query = supabase
      .from("doctors")
      .select("*")
      .eq("is_deleted", false)
      .order("updated_at", { ascending: false })
      .limit(50);

    if (params.q) {
      query = query.ilike("full_name", `%${params.q}%`);
    }
    if (params.uf) {
      query = query.eq("state_uf", params.uf.toUpperCase());
    }
    if (params.status) {
      query = query.eq("classification", params.status);
    }

    const result = await query;
    doctors = (result.data ?? []) as Doctor[];
    error = result.error;
  } else {
    error = { message: "Supabase não configurado" };
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
            Médicos
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Nome não é identificador único — use CRM+UF e evidências.
          </p>
        </div>
        <Link
          href="/medicos/novo"
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Novo médico
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
          defaultValue={params.uf}
          placeholder="UF"
          maxLength={2}
          className="rounded-md border border-[var(--border)] px-3 py-2 text-sm uppercase"
        />
        <select
          name="status"
          defaultValue={params.status ?? ""}
          className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
        >
          <option value="">Todos os status</option>
          <option value="possivel_candidato">Possível candidato</option>
          <option value="atuacao_provavel">Atuação provável</option>
          <option value="atuacao_institucional_confirmada">
            Atuação institucional confirmada
          </option>
          <option value="especialista_confirmado">Especialista confirmado</option>
          <option value="rejeitado">Rejeitado</option>
          <option value="inativo">Inativo</option>
        </select>
        <button
          type="submit"
          className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--ink)] hover:bg-[var(--border)]"
        >
          Filtrar
        </button>
      </form>

      {error ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Não foi possível carregar médicos. Confira as variáveis do Supabase e
          se a migration foi aplicada.
        </p>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--border)] bg-[var(--surface-2)] text-xs uppercase tracking-wide text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">UF / Cidade</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Camada</th>
              <th className="px-4 py-3 font-medium">Confiança</th>
            </tr>
          </thead>
          <tbody>
            {doctors.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-10 text-center text-[var(--muted)]"
                >
                  Nenhum médico encontrado.
                </td>
              </tr>
            ) : (
              doctors.map((doctor) => (
                <tr
                  key={doctor.id}
                  className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)]/60"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/medicos/${doctor.id}`}
                      className="font-medium text-[var(--accent)] hover:underline"
                    >
                      {doctor.full_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[var(--ink-soft)]">
                    {[doctor.state_uf, doctor.city].filter(Boolean).join(" · ") ||
                      "—"}
                  </td>
                  <td className="px-4 py-3">
                    <ClassificationBadge value={doctor.classification} />
                  </td>
                  <td className="px-4 py-3">
                    <LayerBadge value={doctor.layer} />
                  </td>
                  <td className="px-4 py-3">
                    <ConfidenceBar score={doctor.confidence_score} />
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
