import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ClassificationBadge,
  ConfidenceBar,
  LayerBadge,
} from "@/components/badges";
import { createClient } from "@/lib/supabase/server";
import type {
  Doctor,
  DoctorFacilityLink,
  HealthFacility,
  MedicalRegistration,
  ProfessionalContact,
} from "@/types/database";

type LinkRow = DoctorFacilityLink & {
  health_facilities: Pick<HealthFacility, "id" | "name" | "city" | "state_uf"> | null;
};

export default async function MedicoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: doctor } = await supabase
    .from("doctors")
    .select("*")
    .eq("id", id)
    .eq("is_deleted", false)
    .maybeSingle();

  if (!doctor) notFound();

  const typedDoctor = doctor as Doctor;

  const [{ data: registrations }, { data: links }, { data: contacts }] =
    await Promise.all([
      supabase
        .from("medical_registrations")
        .select("*")
        .eq("doctor_id", id)
        .order("registration_type"),
      supabase
        .from("doctor_facility_links")
        .select(
          "*, health_facilities(id, name, city, state_uf)",
        )
        .eq("doctor_id", id),
      supabase.from("professional_contacts").select("*").eq("doctor_id", id),
    ]);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/medicos"
          className="text-sm text-[var(--muted)] hover:text-[var(--accent)]"
        >
          ← Médicos
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
              {typedDoctor.full_name}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <ClassificationBadge value={typedDoctor.classification} />
              <LayerBadge value={typedDoctor.layer} />
              <ConfidenceBar score={typedDoctor.confidence_score} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Dados cadastrais">
          <Field label="Cidade" value={typedDoctor.city} />
          <Field label="UF" value={typedDoctor.state_uf} />
          <Field
            label="Última validação"
            value={
              typedDoctor.last_validated_at
                ? new Date(typedDoctor.last_validated_at).toLocaleDateString(
                    "pt-BR",
                  )
                : null
            }
          />
          <Field label="Observações" value={typedDoctor.notes} />
        </Section>

        <Section title="CRM / RQE">
          {(registrations as MedicalRegistration[] | null)?.length ? (
            <ul className="space-y-2">
              {(registrations as MedicalRegistration[]).map((reg) => (
                <li
                  key={reg.id}
                  className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                >
                  <span className="font-medium">
                    {reg.registration_type} {reg.number}/{reg.state_uf}
                  </span>
                  <span className="ml-2 text-[var(--muted)]">{reg.status}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty text="Nenhum registro profissional vinculado." />
          )}
        </Section>

        <Section title="Hospitais e clínicas">
          {(links as LinkRow[] | null)?.length ? (
            <ul className="space-y-2">
              {(links as LinkRow[]).map((link) => (
                <li
                  key={link.id}
                  className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                >
                  <Link
                    href={`/estabelecimentos/${link.facility_id}`}
                    className="font-medium text-[var(--accent)] hover:underline"
                  >
                    {link.health_facilities?.name ?? "Estabelecimento"}
                  </Link>
                  <p className="text-[var(--muted)]">
                    {[link.role_title, link.department]
                      .filter(Boolean)
                      .join(" · ") || "Sem cargo informado"}
                    {link.is_coordinator ? " · Coordenador" : ""}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <Empty text="Nenhum vínculo cadastrado." />
          )}
        </Section>

        <Section title="Contatos profissionais">
          {(contacts as ProfessionalContact[] | null)?.length ? (
            <ul className="space-y-2">
              {(contacts as ProfessionalContact[]).map((contact) => (
                <li
                  key={contact.id}
                  className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                >
                  <span className="uppercase text-[var(--muted)]">
                    {contact.channel}
                  </span>
                  <span className="ml-2 text-[var(--ink)]">{contact.value}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty text="Nenhum contato disponível." />
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
      <h3 className="mb-3 text-sm font-medium text-[var(--ink)]">{title}</h3>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="mb-2 text-sm">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="text-[var(--ink)]">{value || "—"}</p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-[var(--muted)]">{text}</p>;
}
