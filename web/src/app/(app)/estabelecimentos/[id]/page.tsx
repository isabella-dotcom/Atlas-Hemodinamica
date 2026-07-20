import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfidenceBadge, LayerBadge } from "@/components/badges";
import {
  PageHeader,
  ErrorState,
  PermissionGuard,
  ButtonLink,
  EmptyState,
} from "@/components/ui/page";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/data";
import { canWrite } from "@/lib/permissions";
import { formatPhoneDisplay, maskContactValue } from "@/lib/format";
import { getFacilityById } from "@/services/facilities/queries";
import type {
  Doctor,
  DoctorFacilityLink,
  Evidence,
  ProfessionalContact,
} from "@/types/database";
import {
  CONTACT_CHANNEL_LABELS,
  OWNERSHIP_TYPE_LABELS,
} from "@/types/database";
import { FacilityActions } from "./facility-actions";
import { FacilityEntityPanels } from "./facility-entity-panels";

type Tab =
  | "visao"
  | "servico"
  | "medicos"
  | "contatos"
  | "evidencias"
  | "historico";

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

  const [linksRes, contactsRes, evidencesRes, auditsRes, doctorsRes, sourcesRes] =
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
      supabase
        .from("doctors")
        .select("id, full_name")
        .eq("is_deleted", false)
        .order("full_name")
        .limit(300),
      supabase.from("data_sources").select("id, name").eq("is_active", true).order("name"),
    ]);

  const relatedError =
    linksRes.error ||
    contactsRes.error ||
    evidencesRes.error ||
    auditsRes.error ||
    doctorsRes.error ||
    sourcesRes.error;
  if (relatedError) {
    return (
      <ErrorState message="Não foi possível carregar dados relacionados do estabelecimento. Tente novamente." />
    );
  }

  const typedLinks = (linksRes.data ?? []) as (DoctorFacilityLink & {
    doctors: Pick<Doctor, "id" | "full_name" | "classification"> | null;
  })[];
  const contacts = (contactsRes.data ?? []) as ProfessionalContact[];
  const evidences = (evidencesRes.data ?? []) as Evidence[];
  const audits = auditsRes.data ?? [];
  const doctors = (doctorsRes.data ?? []) as { id: string; full_name: string }[];

  const tabs: { id: Tab; label: string }[] = [
    { id: "visao", label: "Visão geral" },
    { id: "servico", label: "Serviço de hemodinâmica" },
    { id: "medicos", label: "Médicos vinculados" },
    { id: "contatos", label: "Contatos" },
    { id: "evidencias", label: "Evidências" },
    { id: "historico", label: "Histórico e auditoria" },
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
            <ButtonLink href={`/estabelecimentos/${id}/editar`} variant="secondary">
              Editar
            </ButtonLink>
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
        {facility.is_demo ? (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800">
            DADO FICTÍCIO
          </span>
        ) : null}
        {facility.is_active === false ? (
          <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs">
            Inativo
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
            <Item label="Natureza jurídica" value={facility.legal_nature} />
            <Item
              label="Público/privado"
              value={
                facility.ownership_type
                  ? OWNERSHIP_TYPE_LABELS[facility.ownership_type]
                  : null
              }
            />
            <Item label="Matriz/filial" value={facility.branch_type} />
            <Item
              label="Endereço"
              value={[
                facility.address_street,
                facility.address_number,
                facility.address_complement,
                facility.address_district,
                facility.address_zip,
              ]
                .filter(Boolean)
                .join(", ")}
            />
            <Item label="IBGE" value={facility.ibge_city_code} />
            <Item label="Região" value={facility.region} />
            <Item
              label="Coordenadas"
              value={
                facility.latitude != null && facility.longitude != null
                  ? `${facility.latitude}, ${facility.longitude}`
                  : null
              }
            />
            <Item label="Telefone" value={formatPhoneDisplay(facility.phone)} />
            <Item label="E-mail" value={facility.email} />
            <Item label="Site" value={facility.website} />
            <Item label="Observações" value={facility.notes} />
          </dl>
        </section>
      ) : null}

      {tab === "servico" ? (
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 text-sm">
          <dl className="grid gap-3 md:grid-cols-2">
            <Item label="Hemodinâmica" value={yn(facility.has_hemodynamics)} />
            <Item label="Cateterismo" value={yn(facility.has_catheterization_lab)} />
            <Item
              label="Cardiologia intervencionista"
              value={yn(facility.has_interventional_cardiology)}
            />
            <Item
              label="Radiologia intervencionista"
              value={yn(facility.has_interventional_radiology)}
            />
            <Item
              label="Neurorradiologia intervencionista"
              value={yn(facility.has_interventional_neuroradiology)}
            />
            <Item label="SUS" value={yn(facility.attends_sus)} />
            <Item label="Particular" value={yn(facility.attends_private)} />
            <Item label="Convênios" value={yn(facility.attends_insurance)} />
            <Item label="24 horas" value={yn(facility.is_24_hours)} />
            <Item label="Urgência/emergência" value={yn(facility.has_emergency_service)} />
            <Item label="Salas (est.)" value={facility.estimated_rooms?.toString()} />
            <Item label="Equipamentos (est.)" value={facility.estimated_equipment?.toString()} />
            <Item label="Telefone hemo" value={formatPhoneDisplay(facility.hemodynamics_phone)} />
            <Item label="WhatsApp institucional" value={formatPhoneDisplay(facility.institutional_whatsapp)} />
            <Item label="E-mail hemo" value={facility.hemodynamics_email} />
            <Item label="Secretaria" value={facility.secretary_contact} />
            <Item label="Responsável pelo serviço" value={facility.service_manager_contact} />
            <Item label="Procedimentos" value={facility.procedures} />
            <Item label="Notas do serviço" value={facility.service_notes} />
            <Item
              label="Última confirmação"
              value={
                facility.last_service_confirmed_at
                  ? new Date(facility.last_service_confirmed_at).toLocaleString("pt-BR")
                  : null
              }
            />
          </dl>
        </section>
      ) : null}

      {tab === "medicos" ? (
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          {typedLinks.length === 0 ? (
            <EmptyState title="Nenhum médico vinculado" />
          ) : (
            <ul className="space-y-2">
              {typedLinks.map((link) => (
                <li key={link.id} className="rounded-md border border-[var(--border)] px-3 py-2 text-sm">
                  <Link
                    href={`/medicos/${link.doctor_id}`}
                    className="text-[var(--accent)] hover:underline"
                  >
                    {link.doctors?.full_name}
                  </Link>
                  <p className="text-[var(--muted)]">
                    {[link.function_title, link.role_title, link.department]
                      .filter(Boolean)
                      .join(" · ") || "Sem cargo"}
                    {link.is_coordinator ? " · Coordenador" : ""}
                    {link.is_team_leader ? " · Chefe de equipe" : ""}
                    {link.is_technical_responsible ? " · RT" : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <PermissionGuard allowed={writable}>
            <FacilityEntityPanels
              facilityId={id}
              mode="link"
              doctors={doctors}
            />
          </PermissionGuard>
        </section>
      ) : null}

      {tab === "contatos" ? (
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <PermissionGuard
            allowed={writable}
            fallback={
              <ul className="space-y-2 text-sm">
                {contacts.length === 0 ? (
                  <EmptyState title="Nenhum contato cadastrado" />
                ) : (
                  contacts.map((c) => (
                    <li key={c.id}>
                      {CONTACT_CHANNEL_LABELS[c.channel] ?? c.channel}:{" "}
                      {maskContactValue(
                        formatPhoneDisplay(c.value) || c.value,
                        c.channel,
                        c.do_not_contact || !c.is_publicly_available,
                      )}
                    </li>
                  ))
                )}
              </ul>
            }
          >
            <FacilityEntityPanels
              facilityId={id}
              mode="contact"
              contacts={contacts}
            />
          </PermissionGuard>
        </section>
      ) : null}

      {tab === "evidencias" ? (
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <PermissionGuard
            allowed={writable}
            fallback={
              evidences.length === 0 ? (
                <EmptyState title="Nenhuma evidência" />
              ) : (
                <ul className="space-y-2 text-sm">
                  {evidences.map((e) => (
                    <li key={e.id}>{e.title}</li>
                  ))}
                </ul>
              )
            }
          >
            <FacilityEntityPanels
              facilityId={id}
              mode="evidence"
              evidences={evidences}
              sources={sourcesRes.data ?? []}
            />
          </PermissionGuard>
        </section>
      ) : null}

      {tab === "historico" ? (
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          {audits.length === 0 ? (
            <EmptyState title="Sem eventos de auditoria" />
          ) : (
            <ul className="space-y-2 text-sm">
              {audits.map((a) => (
                <li key={a.id}>
                  {a.action} · {new Date(a.created_at).toLocaleString("pt-BR")}
                </li>
              ))}
            </ul>
          )}
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

function yn(value: boolean | null | undefined): string | null {
  if (value == null) return null;
  return value ? "Sim" : "Não";
}
