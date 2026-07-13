import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ClassificationBadge,
  ConfidenceBadge,
  EvidenceBadge,
  LayerBadge,
  ValidationBadge,
} from "@/components/badges";
import { PageHeader, ErrorState, PermissionGuard } from "@/components/ui/page";
import { getCurrentProfile } from "@/lib/data";
import { canWrite } from "@/lib/permissions";
import { confidenceBand, maskContactValue } from "@/lib/format";
import {
  explainConfidence,
  getDoctorById,
  getDoctorRegistrations,
  getDoctorSpecialties,
} from "@/services/doctors/queries";
import { createClient } from "@/lib/supabase/server";
import { DoctorActionsPanel } from "./doctor-actions-panel";
import type {
  DoctorFacilityLink,
  Evidence,
  HealthFacility,
  ProfessionalContact,
  AuditLog,
} from "@/types/database";

type Tab = "visao" | "registros" | "especialidades" | "vinculos" | "contatos" | "evidencias" | "historico";

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

  const links = (linksRes.data ?? []) as (DoctorFacilityLink & {
    health_facilities: Pick<HealthFacility, "id" | "name" | "city" | "state_uf"> | null;
  })[];
  const contacts = (contactsRes.data ?? []) as ProfessionalContact[];
  const evidences = (evidencesRes.data ?? []) as Evidence[];
  const audits = (auditRes.data ?? []) as AuditLog[];
  const tabs: { id: Tab; label: string }[] = [
    { id: "visao", label: "Visão geral" },
    { id: "registros", label: "Registros" },
    { id: "especialidades", label: "Especialidades" },
    { id: "vinculos", label: "Vínculos" },
    { id: "contatos", label: "Contatos" },
    { id: "evidencias", label: "Evidências" },
    { id: "historico", label: "Histórico" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={doctor.full_name}
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
            <p className="text-sm">CRM/RQE: {(registrations.success ? registrations.data : []).map((r) => `${r.registration_type} ${r.number}/${r.state_uf}`).join(" · ") || "—"}</p>
            <p className="mt-2 text-sm">Especialidade: {(specialties.success ? specialties.data : []).map((s) => s.specialties?.name).filter(Boolean).join(", ") || "—"}</p>
            <p className="mt-2 text-sm">Vínculo principal: {links[0]?.health_facilities?.name || "—"}</p>
            <p className="mt-2 text-sm">Observações: {doctor.notes || "—"}</p>
          </Card>
          <Card title="Qualidade do cadastro">
            {confidence.success && confidence.data ? (
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
              <p className="text-sm text-[var(--muted)]">
                Aplique a migration 004 para ver a explicação da confiança.
              </p>
            )}
          </Card>
        </div>
      ) : null}

      {tab === "registros" ? (
        <Card title="CRM / RQE">
          <ul className="space-y-2">
            {(registrations.success ? registrations.data : []).map((reg) => (
              <li key={reg.id} className="rounded-md border border-[var(--border)] px-3 py-2 text-sm">
                <strong>{reg.registration_type}</strong> {reg.number}/{reg.state_uf} · {reg.status}
                {reg.is_primary ? " · principal" : ""}
              </li>
            ))}
          </ul>
          <PermissionGuard allowed={writable}>
            <DoctorActionsPanel
              doctorId={id}
              isArchived={doctor.is_deleted}
              mode="registration"
              sources={sourcesRes.data ?? []}
            />
          </PermissionGuard>
        </Card>
      ) : null}

      {tab === "especialidades" ? (
        <Card title="Especialidades">
          <ul className="space-y-2">
            {(specialties.success ? specialties.data : []).map((item) => (
              <li key={item.id} className="rounded-md border border-[var(--border)] px-3 py-2 text-sm">
                {item.specialties?.name ?? "Especialidade"}
                {item.is_primary ? " · principal" : ""}
                {item.is_confirmed ? " · confirmada" : " · não confirmada"}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {tab === "vinculos" ? (
        <Card title="Vínculos">
          <ul className="space-y-2">
            {links.map((link) => (
              <li key={link.id} className="rounded-md border border-[var(--border)] px-3 py-2 text-sm">
                <Link href={`/estabelecimentos/${link.facility_id}`} className="text-[var(--accent)] hover:underline">
                  {link.health_facilities?.name}
                </Link>
                <p className="text-[var(--muted)]">
                  {[link.role_title, link.department].filter(Boolean).join(" · ") || "Sem cargo"}
                  {link.is_coordinator ? " · Coordenador" : ""}
                  {link.coordinator_confirmed ? " (confirmado)" : link.is_coordinator ? " (provável)" : ""}
                </p>
              </li>
            ))}
          </ul>
          <PermissionGuard allowed={writable}>
            <DoctorActionsPanel
              doctorId={id}
              isArchived={doctor.is_deleted}
              mode="link"
              facilities={facilitiesRes.data ?? []}
              sources={sourcesRes.data ?? []}
            />
          </PermissionGuard>
        </Card>
      ) : null}

      {tab === "contatos" ? (
        <Card title="Contatos">
          <ul className="space-y-2">
            {contacts.map((contact) => (
              <li key={contact.id} className="rounded-md border border-[var(--border)] px-3 py-2 text-sm">
                <span className="uppercase text-[var(--muted)]">{contact.channel}</span>{" "}
                {maskContactValue(
                  contact.value,
                  contact.channel,
                  !writable && (contact.do_not_contact || !contact.is_publicly_available),
                )}
                {contact.do_not_contact ? " · não contatar" : ""}
              </li>
            ))}
          </ul>
          <PermissionGuard allowed={writable}>
            <DoctorActionsPanel
              doctorId={id}
              isArchived={doctor.is_deleted}
              mode="contact"
              sources={sourcesRes.data ?? []}
            />
          </PermissionGuard>
        </Card>
      ) : null}

      {tab === "evidencias" ? (
        <Card title="Evidências">
          <ul className="space-y-2">
            {evidences.map((ev) => (
              <li key={ev.id} className="rounded-md border border-[var(--border)] px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span>{ev.title}</span>
                  <EvidenceBadge value={ev.status} />
                </div>
                {ev.confirmed_field ? (
                  <p className="text-[var(--muted)]">Campo: {ev.confirmed_field}</p>
                ) : null}
              </li>
            ))}
          </ul>
          <PermissionGuard allowed={writable}>
            <DoctorActionsPanel
              doctorId={id}
              isArchived={doctor.is_deleted}
              mode="evidence"
              sources={sourcesRes.data ?? []}
            />
          </PermissionGuard>
        </Card>
      ) : null}

      {tab === "historico" ? (
        <Card title="Histórico de alterações">
          {audits.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Sem eventos de auditoria.</p>
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
