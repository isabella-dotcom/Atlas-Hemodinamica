import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfidenceBadge, LayerBadge } from "@/components/badges";
import { PageHeader, ErrorState, PermissionGuard, ButtonLink } from "@/components/ui/page";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/data";
import { canWrite } from "@/lib/permissions";
import { getFacilityById } from "@/services/facilities/queries";
import type { Doctor, DoctorFacilityLink, Evidence, ProfessionalContact } from "@/types/database";
import { FacilityActions } from "./facility-actions";

type Tab = "visao" | "medicos" | "contatos" | "evidencias" | "historico";

export default async function EstabelecimentoDetalhePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const tab = (sp.tab as Tab) || "visao";
  const profile = await getCurrentProfile();
  const writable = canWrite(profile?.role);

  const facilityResult = await getFacilityById(id);
  if (!facilityResult.success) {
    if (facilityResult.error.code === "NOT_FOUND") notFound();
    return <ErrorState message={facilityResult.error.message} />;
  }
  const facility = facilityResult.data;
  const supabase = await createClient();

  const [{ data: links }, { data: contacts }, { data: evidences }, { data: audits }] =
    await Promise.all([
      supabase
        .from("doctor_facility_links")
        .select("*, doctors(id, full_name, classification)")
        .eq("facility_id", id)
        .eq("is_deleted", false),
      supabase
        .from("professional_contacts")
        .select("*")
        .eq("facility_id", id)
        .eq("is_deleted", false),
      supabase
        .from("evidences")
        .select("*")
        .eq("entity_type", "facility")
        .eq("entity_id", id),
      supabase
        .from("audit_logs")
        .select("*")
        .eq("entity_type", "facility")
        .eq("entity_id", id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

  const typedLinks = (links ?? []) as (DoctorFacilityLink & {
    doctors: Pick<Doctor, "id" | "full_name" | "classification"> | null;
  })[];

  const tabs: { id: Tab; label: string }[] = [
    { id: "visao", label: "Visão geral" },
    { id: "medicos", label: "Médicos" },
    { id: "contatos", label: "Contatos" },
    { id: "evidencias", label: "Evidências" },
    { id: "historico", label: "Histórico" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={facility.trade_name || facility.name}
        description={`${facility.city}/${facility.state_uf}`}
        breadcrumbs={[
          { label: "Estabelecimentos", href: "/estabelecimentos" },
          { label: facility.name },
        ]}
        actions={
          <PermissionGuard allowed={writable}>
            <FacilityActions facilityId={id} />
            <ButtonLink href={`/medicos/novo`} variant="secondary">
              Novo candidato
            </ButtonLink>
          </PermissionGuard>
        }
      />

      <div className="flex flex-wrap gap-2">
        <LayerBadge value={facility.layer} />
        <ConfidenceBadge score={facility.confidence_score} />
        {facility.has_hemodynamics ? (
          <span className="rounded border border-teal-200 bg-teal-50 px-2 py-0.5 text-xs text-teal-900">
            Hemodinâmica
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 border-b border-[var(--border)] pb-2">
        {tabs.map((item) => (
          <Link
            key={item.id}
            href={`/estabelecimentos/${id}?tab=${item.id}`}
            className={`rounded-md px-3 py-1.5 text-sm ${
              tab === item.id
                ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                : "text-[var(--ink-soft)] hover:bg-[var(--surface-2)]"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {tab === "visao" ? (
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 text-sm">
          <dl className="grid gap-3 md:grid-cols-2">
            <Item label="Razão social" value={facility.name} />
            <Item label="Nome fantasia" value={facility.trade_name} />
            <Item label="CNES" value={facility.cnes} />
            <Item label="CNPJ" value={facility.cnpj} />
            <Item label="Tipo" value={facility.facility_type} />
            <Item
              label="SUS"
              value={
                facility.attends_sus == null
                  ? null
                  : facility.attends_sus
                    ? "Sim"
                    : "Não"
              }
            />
            <Item
              label="Endereço"
              value={[
                facility.address_street,
                facility.address_number,
                facility.address_district,
                facility.address_zip,
              ]
                .filter(Boolean)
                .join(", ")}
            />
            <Item label="Telefone" value={facility.phone} />
            <Item label="E-mail" value={facility.email} />
            <Item label="Site" value={facility.website} />
          </dl>
        </section>
      ) : null}

      {tab === "medicos" ? (
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <ul className="space-y-2">
            {typedLinks.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">Nenhum médico vinculado.</p>
            ) : (
              typedLinks.map((link) => (
                <li key={link.id} className="rounded-md border border-[var(--border)] px-3 py-2 text-sm">
                  <Link href={`/medicos/${link.doctor_id}`} className="text-[var(--accent)] hover:underline">
                    {link.doctors?.full_name}
                  </Link>
                  <p className="text-[var(--muted)]">
                    {[link.role_title, link.department].filter(Boolean).join(" · ") || "Sem cargo"}
                    {link.is_coordinator ? " · Coordenador" : ""}
                  </p>
                </li>
              ))
            )}
          </ul>
        </section>
      ) : null}

      {tab === "contatos" ? (
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <ul className="space-y-2 text-sm">
            {((contacts ?? []) as ProfessionalContact[]).map((c) => (
              <li key={c.id}>
                {c.channel}: {c.value}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {tab === "evidencias" ? (
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <ul className="space-y-2 text-sm">
            {((evidences ?? []) as Evidence[]).map((e) => (
              <li key={e.id}>{e.title}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {tab === "historico" ? (
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <ul className="space-y-2 text-sm">
            {(audits ?? []).map((a) => (
              <li key={a.id}>
                {a.action} · {new Date(a.created_at).toLocaleString("pt-BR")}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Item({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs text-[var(--muted)]">{label}</dt>
      <dd>{value || "—"}</dd>
    </div>
  );
}
