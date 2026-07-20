import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ClassificationBadge,
  ConfidenceBadge,
  EvidenceBadge,
  LayerBadge,
  ValidationBadge,
} from "@/components/badges";
import { PageHeader, ErrorState, PermissionGuard, EmptyState } from "@/components/ui/page";
import { getCurrentProfile } from "@/lib/data";
import { canWrite } from "@/lib/permissions";
import { confidenceBand, formatPhoneDisplay, maskContactValue } from "@/lib/format";
import {
  explainConfidence,
  getDoctorById,
  getDoctorRegistrations,
  getDoctorSpecialties,
  listSpecialties,
} from "@/services/doctors/queries";
import { createClient } from "@/lib/supabase/server";
import { DoctorActionsPanel, RemoveSpecialtyButton } from "./doctor-actions-panel";
import type {
  DoctorFacilityLink,
  Evidence,
  HealthFacility,
  ProfessionalContact,
  AuditLog,
  Specialty,
} from "@/types/database";
import { CONTACT_CHANNEL_LABELS } from "@/types/database";

type Tab =
  | "visao"
  | "registros"
  | "especialidades"
  | "vinculos"
  | "contatos"
  | "evidencias"
  | "historico";

export default async function MedicoDetalhePage({
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

  const doctorResult = await getDoctorById(id);
  if (!doctorResult.success) {
    if (doctorResult.error.code === "NOT_FOUND") notFound();
    return <ErrorState message={doctorResult.error.message} />;
  }
  const doctor = doctorResult.data;

  const supabase = await createClient();
  const [
    registrations,
    specialties,
    catalogSpecialties,
    confidence,
    linksRes,
    contactsRes,
    evidencesRes,
    auditRes,
    facilitiesRes,
    sourcesRes,
  ] = await Promise.all([
    getDoctorRegistrations(id),
    getDoctorSpecialties(id),
    listSpecialties(),
    explainConfidence(id),
    supabase
      .from("doctor_facility_links")
      .select("*, health_facilities(id, name, city, state_uf)")
      .eq("doctor_id", id)
      .eq("is_deleted", false),
    supabase
      .from("professional_contacts")
      .select("*")
      .eq("doctor_id", id)
      .eq("is_deleted", false),
    supabase
      .from("evidences")
      .select("*")
      .eq("entity_type", "doctor")
      .eq("entity_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("audit_logs")
      .select("*")
      .eq("entity_type", "doctor")
      .eq("entity_id", id)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("health_facilities")
      .select("id, name, city, state_uf")
      .eq("is_deleted", false)
      .order("name")
      .limit(300),
    supabase.from("data_sources").select("id, name").eq("is_active", true).order("name"),
  ]);

  const relatedError =
    linksRes.error ||
    contactsRes.error ||
    evidencesRes.error ||
    auditRes.error ||
    facilitiesRes.error ||
    sourcesRes.error;
  if (relatedError) {
    return (
      <ErrorState message="Não foi possível carregar dados relacionados do médico. Tente novamente." />
    );
  }

  if (!registrations.success) {
    return <ErrorState message={registrations.error.message} />;
  }
  if (!specialties.success) {
    return <ErrorState message={specialties.error.message} />;
  }

  const links = (linksRes.data ?? []) as (DoctorFacilityLink & {
    health_facilities: Pick<HealthFacility, "id" | "name" | "city" | "state_uf"> | null;
  })[];
  const contacts = (contactsRes.data ?? []) as ProfessionalContact[];
  const evidences = (evidencesRes.data ?? []) as Evidence[];
  const audits = (auditRes.data ?? []) as AuditLog[];
  const specialtyCatalog = catalogSpecialties.success
    ? (catalogSpecialties.data as Specialty[])
    : [];

  const tabs: { id: Tab; label: string }[] = [
    { id: "visao", label: "Visão geral" },
    { id: "registros", label: "Registros profissionais" },
    { id: "especialidades", label: "Especialidades e formação" },
    { id: "vinculos", label: "Estabelecimentos" },
    { id: "contatos", label: "Contatos" },
    { id: "evidencias", label: "Evidências" },
    { id: "historico", label: "Histórico e auditoria" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={doctor.social_name || doctor.full_name}
        description={[doctor.city, doctor.state_uf].filter(Boolean).join(" / ") || "Local não informado"}
        breadcrumbs={[
          { label: "Médicos", href: "/medicos" },
          { label: doctor.full_name },
        ]}
        actions={
          <PermissionGuard allowed={writable}>
            <DoctorActionsPanel
              doctorId={doctor.id}
              isArchived={doctor.is_deleted}
              mode="header"
            />
          </PermissionGuard>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <ClassificationBadge value={doctor.classification} />
        <ValidationBadge value={doctor.validation_status} />
        <LayerBadge value={doctor.layer} />
        <ConfidenceBadge score={doctor.confidence_score} />
        {doctor.is_demo ? (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800">
            DADO FICTÍCIO
          </span>
        ) : null}
        {doctor.last_validated_at ? (
          <span className="text-xs text-[var(--muted)]">
            Última validação:{" "}
            {new Date(doctor.last_validated_at).toLocaleDateString("pt-BR")}
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 border-b border-[var(--border)] pb-2">
        {tabs.map((item) => (
          <Link
            key={item.id}
            href={`/medicos/${id}?tab=${item.id}`}
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
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Resumo">
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-[var(--muted)]">Nome completo</dt>
                <dd>{doctor.full_name}</dd>
              </div>
              {doctor.social_name ? (
                <div>
                  <dt className="text-[var(--muted)]">Nome social</dt>
                  <dd>{doctor.social_name}</dd>
                </div>
              ) : null}
              {writable && doctor.birth_date ? (
                <div>
                  <dt className="text-[var(--muted)]">Data de nascimento</dt>
                  <dd>{doctor.birth_date}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-[var(--muted)]">CRM/RQE</dt>
                <dd>
                  {registrations.data
                    .map((r) => `${r.registration_type} ${r.number}/${r.state_uf}`)
                    .join(" · ") || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Especialidades</dt>
                <dd>
                  {specialties.data.map((s) => s.specialties?.name).filter(Boolean).join(", ") ||
                    "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Biografia</dt>
                <dd>{doctor.biography || "—"}</dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Observações internas</dt>
                <dd>{doctor.notes || "—"}</dd>
              </div>
            </dl>
          </Card>
          <Card title="Qualidade do cadastro">
            {confidence.success ? (
              <div className="space-y-2 text-sm">
                <p>
                  Pontuação: <strong>{confidence.data.score}%</strong> ·{" "}
                  {confidenceBand(confidence.data.score)}
                </p>
                <ul className="text-[var(--ink-soft)]">
                  <li>CRM: +{confidence.data.components.crm}</li>
                  <li>RQE: +{confidence.data.components.rqe}</li>
                  <li>Vínculos: +{confidence.data.components.links}</li>
                  <li>Evidências: +{confidence.data.components.evidences}</li>
                  <li>Contatos: +{confidence.data.components.contacts}</li>
                  <li>Penalidades: -{confidence.data.components.penalties}</li>
                </ul>
                <p className="text-xs text-[var(--muted)]">{confidence.data.note}</p>
              </div>
            ) : (
              <p className="text-sm text-rose-800">{confidence.error.message}</p>
            )}
          </Card>
        </div>
      ) : null}

      {tab === "registros" ? (
        <Card title="Registros profissionais">
          {registrations.data.length === 0 ? (
            <EmptyState title="Nenhum CRM/RQE cadastrado" />
          ) : null}
          <PermissionGuard allowed={writable}>
            <DoctorActionsPanel
              doctorId={id}
              isArchived={doctor.is_deleted}
              mode="registration"
              sources={sourcesRes.data ?? []}
              registrations={registrations.data}
            />
          </PermissionGuard>
          {!writable ? (
            <ul className="mt-2 space-y-2">
              {registrations.data.map((reg) => (
                <li key={reg.id} className="rounded-md border border-[var(--border)] px-3 py-2 text-sm">
                  <strong>{reg.registration_type}</strong> {reg.number}/{reg.state_uf} · {reg.status}
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      ) : null}

      {tab === "especialidades" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Especialidades">
            <ul className="space-y-2">
              {specialties.data.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                >
                  <span>
                    {item.specialties?.name ?? "Especialidade"}
                    {item.is_primary ? " · principal" : ""}
                    {item.is_confirmed ? " · confirmada" : " · não confirmada"}
                    {` · confiança ${item.confidence_score}`}
                  </span>
                  <PermissionGuard allowed={writable}>
                    <RemoveSpecialtyButton id={item.id} />
                  </PermissionGuard>
                </li>
              ))}
            </ul>
            {specialties.data.length === 0 ? (
              <EmptyState title="Nenhuma especialidade vinculada" />
            ) : null}
            <PermissionGuard allowed={writable}>
              <DoctorActionsPanel
                doctorId={id}
                isArchived={doctor.is_deleted}
                mode="specialty"
                specialties={specialtyCatalog}
                sources={sourcesRes.data ?? []}
              />
            </PermissionGuard>
          </Card>
          <Card title="Formação">
            <dl className="space-y-2 text-sm">
              <Row label="Graduação" value={doctor.graduation_institution} />
              <Row label="Ano" value={doctor.graduation_year?.toString()} />
              <Row label="Residência" value={doctor.residency} />
              <Row label="Especialização" value={doctor.specialization} />
              <Row label="Fellowships" value={doctor.fellowships?.join(", ")} />
              <Row label="Mestrado" value={doctor.masters_degree} />
              <Row label="Doutorado" value={doctor.doctorate_degree} />
              <Row label="Títulos" value={doctor.professional_titles?.join(", ")} />
              <Row label="Sociedades" value={doctor.medical_societies?.join(", ")} />
              <Row
                label="SBHCI"
                value={
                  doctor.is_sbhci_member == null
                    ? null
                    : doctor.is_sbhci_member
                      ? "Sim"
                      : "Não"
                }
              />
              <Row label="Lattes" value={doctor.lattes_url} />
              <Row label="ORCID" value={doctor.orcid} />
              <Row label="Área declarada" value={doctor.declared_practice_area} />
              <Row label="Área confirmada" value={doctor.confirmed_practice_area} />
              <Row label="Palavras-chave" value={doctor.practice_keywords?.join(", ")} />
            </dl>
          </Card>
        </div>
      ) : null}

      {tab === "vinculos" ? (
        <Card title="Estabelecimentos vinculados">
          {links.length === 0 ? (
            <EmptyState title="Nenhum vínculo cadastrado" />
          ) : null}
          <PermissionGuard allowed={writable}>
            <DoctorActionsPanel
              doctorId={id}
              isArchived={doctor.is_deleted}
              mode="link"
              facilities={facilitiesRes.data ?? []}
              sources={sourcesRes.data ?? []}
              links={links}
            />
          </PermissionGuard>
          {!writable ? (
            <ul className="mt-2 space-y-2">
              {links.map((link) => (
                <li key={link.id} className="rounded-md border border-[var(--border)] px-3 py-2 text-sm">
                  <Link
                    href={`/estabelecimentos/${link.facility_id}`}
                    className="text-[var(--accent)] hover:underline"
                  >
                    {link.health_facilities?.name}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      ) : null}

      {tab === "contatos" ? (
        <Card title="Contatos">
          {contacts.length === 0 ? <EmptyState title="Nenhum contato" /> : null}
          <PermissionGuard
            allowed={writable}
            fallback={
              <ul className="space-y-2">
                {contacts.map((contact) => (
                  <li key={contact.id} className="rounded-md border border-[var(--border)] px-3 py-2 text-sm">
                    <span className="text-[var(--muted)]">
                      {CONTACT_CHANNEL_LABELS[contact.channel] ?? contact.channel}
                    </span>{" "}
                    {maskContactValue(
                      ["telefone", "celular", "whatsapp"].includes(contact.channel)
                        ? formatPhoneDisplay(contact.value)
                        : contact.value,
                      contact.channel,
                      contact.do_not_contact || !contact.is_publicly_available,
                    )}
                  </li>
                ))}
              </ul>
            }
          >
            <DoctorActionsPanel
              doctorId={id}
              isArchived={doctor.is_deleted}
              mode="contact"
              sources={sourcesRes.data ?? []}
              contacts={contacts}
            />
          </PermissionGuard>
        </Card>
      ) : null}

      {tab === "evidencias" ? (
        <Card title="Evidências">
          {evidences.length === 0 ? <EmptyState title="Nenhuma evidência" /> : null}
          {!writable ? (
            <ul className="space-y-2">
              {evidences.map((ev) => (
                <li key={ev.id} className="rounded-md border border-[var(--border)] px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span>{ev.title}</span>
                    <EvidenceBadge value={ev.status} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <DoctorActionsPanel
              doctorId={id}
              isArchived={doctor.is_deleted}
              mode="evidence"
              sources={sourcesRes.data ?? []}
              evidences={evidences}
            />
          )}
        </Card>
      ) : null}

      {tab === "historico" ? (
        <Card title="Histórico de alterações">
          {audits.length === 0 ? (
            <EmptyState title="Sem eventos de auditoria" />
          ) : (
            <ul className="space-y-2">
              {audits.map((item) => (
                <li key={item.id} className="rounded-md border border-[var(--border)] px-3 py-2 text-sm">
                  <p>{item.action}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {new Date(item.created_at).toLocaleString("pt-BR")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
      <h3 className="mb-3 text-sm font-medium">{title}</h3>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-[var(--muted)]">{label}</dt>
      <dd>{value || "—"}</dd>
    </div>
  );
}
