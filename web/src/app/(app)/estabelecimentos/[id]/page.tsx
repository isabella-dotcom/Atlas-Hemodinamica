import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfidenceBar, LayerBadge } from "@/components/badges";
import { createClient } from "@/lib/supabase/server";
import type { Doctor, DoctorFacilityLink, HealthFacility } from "@/types/database";

type LinkRow = DoctorFacilityLink & {
  doctors: Pick<Doctor, "id" | "full_name" | "classification"> | null;
};

export default async function EstabelecimentoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: facility } = await supabase
    .from("health_facilities")
    .select("*")
    .eq("id", id)
    .eq("is_deleted", false)
    .maybeSingle();

  if (!facility) notFound();
  const typed = facility as HealthFacility;

  const { data: links } = await supabase
    .from("doctor_facility_links")
    .select("*, doctors(id, full_name, classification)")
    .eq("facility_id", id);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/estabelecimentos"
          className="text-sm text-[var(--muted)] hover:text-[var(--accent)]"
        >
          ← Estabelecimentos
        </Link>
        <h2 className="mt-3 font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
          {typed.name}
        </h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <LayerBadge value={typed.layer} />
          <ConfidenceBar score={typed.confidence_score} />
          {typed.has_hemodynamics ? (
            <span className="rounded border border-teal-200 bg-teal-50 px-2 py-0.5 text-xs text-teal-900">
              Hemodinâmica
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <h3 className="mb-3 text-sm font-medium">Informações institucionais</h3>
          <dl className="space-y-2 text-sm">
            <Item label="CNES" value={typed.cnes} />
            <Item label="CNPJ" value={typed.cnpj} />
            <Item label="Tipo" value={typed.facility_type} />
            <Item
              label="Endereço"
              value={[
                typed.address_street,
                typed.address_number,
                typed.address_district,
                typed.city,
                typed.state_uf,
              ]
                .filter(Boolean)
                .join(", ")}
            />
            <Item label="Telefone" value={typed.phone} />
            <Item label="E-mail" value={typed.email} />
            <Item label="Site" value={typed.website} />
            <Item
              label="Atende SUS"
              value={
                typed.attends_sus == null
                  ? null
                  : typed.attends_sus
                    ? "Sim"
                    : "Não"
              }
            />
          </dl>
        </section>

        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <h3 className="mb-3 text-sm font-medium">Médicos vinculados</h3>
          {(links as LinkRow[] | null)?.length ? (
            <ul className="space-y-2">
              {(links as LinkRow[]).map((link) => (
                <li
                  key={link.id}
                  className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                >
                  <Link
                    href={`/medicos/${link.doctor_id}`}
                    className="font-medium text-[var(--accent)] hover:underline"
                  >
                    {link.doctors?.full_name ?? "Médico"}
                  </Link>
                  <p className="text-[var(--muted)]">
                    {[link.role_title, link.department]
                      .filter(Boolean)
                      .join(" · ") || "Sem cargo"}
                    {link.is_coordinator ? " · Coordenador" : ""}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--muted)]">
              Nenhum vínculo cadastrado.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function Item({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs text-[var(--muted)]">{label}</dt>
      <dd className="text-[var(--ink)]">{value || "—"}</dd>
    </div>
  );
}
