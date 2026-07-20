"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  archiveDoctorAction,
  restoreDoctorAction,
  sendDoctorToReviewAction,
  upsertRegistrationAction,
  updateRegistrationAction,
  addDoctorSpecialtyAction,
  removeDoctorSpecialtyAction,
} from "@/services/doctors/mutations";
import {
  archiveLinkAction,
  createContactAction,
  createEvidenceAction,
  createLinkAction,
  decideEvidenceAction,
  getEvidenceSignedUrlAction,
  markDoNotContactAction,
  softDeleteContactAction,
  updateContactAction,
  updateLinkAction,
} from "@/services/links-contacts-evidences/mutations";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog, PhoneInput, UfSelect, fieldClass } from "@/components/form-fields";
import { createClient } from "@/lib/supabase/client";
import {
  CONTACT_CHANNEL_LABELS,
  CONTACT_STATUS_LABELS,
  type ContactChannel,
  type ContactStatus,
  type Evidence,
  type MedicalRegistration,
  type ProfessionalContact,
  type Specialty,
} from "@/types/database";
import { formatPhoneDisplay } from "@/lib/format";

export function DoctorActionsPanel({
  doctorId,
  isArchived,
  mode,
  facilities = [],
  sources = [],
  specialties = [],
  registrations = [],
  contacts = [],
  evidences = [],
  links = [],
}: {
  doctorId: string;
  isArchived: boolean;
  mode:
    | "header"
    | "registration"
    | "specialty"
    | "link"
    | "contact"
    | "evidence";
  facilities?: { id: string; name: string; city: string; state_uf: string }[];
  sources?: { id: string; name: string }[];
  specialties?: Specialty[];
  registrations?: MedicalRegistration[];
  contacts?: ProfessionalContact[];
  evidences?: Evidence[];
  links?: {
    id: string;
    facility_id: string;
    role_title: string | null;
    function_title: string | null;
    is_coordinator: boolean;
    is_team_leader: boolean;
    is_technical_responsible: boolean;
    is_clinical_staff: boolean;
    status: string;
    weekly_hours: number | null;
    is_sus_link: boolean | null;
    practiced_specialty: string | null;
    health_facilities?: { name: string } | null;
  }[];
}) {
  const router = useRouter();
  const { push } = useToast();
  const [pending, startTransition] = useTransition();
  const [confirmArchive, setConfirmArchive] = useState(false);

  const [regType, setRegType] = useState<"CRM" | "RQE">("CRM");
  const [crmNumber, setCrmNumber] = useState("");
  const [crmUf, setCrmUf] = useState("MG");
  const [regStatus, setRegStatus] = useState("desconhecido");
  const [isPrimary, setIsPrimary] = useState(false);
  const [consultedAt, setConsultedAt] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [rqeArea, setRqeArea] = useState("");

  const [specialtyId, setSpecialtyId] = useState("");
  const [specPrimary, setSpecPrimary] = useState(false);
  const [specConfirmed, setSpecConfirmed] = useState(false);
  const [specConfidence, setSpecConfidence] = useState(20);

  const [facilityId, setFacilityId] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [functionTitle, setFunctionTitle] = useState("");
  const [practicedSpecialty, setPracticedSpecialty] = useState("");
  const [isCoordinator, setIsCoordinator] = useState(false);
  const [isTeamLeader, setIsTeamLeader] = useState(false);
  const [isTechnical, setIsTechnical] = useState(false);
  const [isClinical, setIsClinical] = useState(false);
  const [weeklyHours, setWeeklyHours] = useState("");
  const [isSusLink, setIsSusLink] = useState(false);
  const [coordJustification, setCoordJustification] = useState("");

  const [contactChannel, setContactChannel] = useState<ContactChannel>("email");
  const [contactValue, setContactValue] = useState("");
  const [contactPrimary, setContactPrimary] = useState(false);

  const [evidenceTitle, setEvidenceTitle] = useState("");
  const [evidenceField, setEvidenceField] = useState("");
  const [evidenceValue, setEvidenceValue] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);

  function run(
    action: () => Promise<{ success: boolean; error?: { message: string } }>,
    okMsg: string,
  ) {
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        push(result.error?.message ?? "Falha na operação.", "error");
        return;
      }
      push(okMsg, "success");
      router.refresh();
    });
  }

  if (mode === "header") {
    return (
      <>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/medicos/${doctorId}/editar`}
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--surface-2)]"
          >
            Editar
          </Link>
          <button
            type="button"
            disabled={pending}
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm disabled:opacity-60"
            onClick={() =>
              run(() => sendDoctorToReviewAction(doctorId), "Enviado para revisão.")
            }
          >
            Enviar para revisão
          </button>
          {isArchived ? (
            <button
              type="button"
              disabled={pending}
              className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
              onClick={() => run(() => restoreDoctorAction(doctorId), "Médico restaurado.")}
            >
              Restaurar
            </button>
          ) : (
            <button
              type="button"
              disabled={pending}
              className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
              onClick={() => setConfirmArchive(true)}
            >
              Arquivar
            </button>
          )}
        </div>
        <ConfirmDialog
          open={confirmArchive}
          title="Arquivar médico?"
          description="O registro será excluído logicamente e sairá das listagens padrão."
          confirmLabel="Arquivar"
          pending={pending}
          onCancel={() => setConfirmArchive(false)}
          onConfirm={() => {
            setConfirmArchive(false);
            run(
              () => archiveDoctorAction(doctorId, "Arquivado pela equipe"),
              "Médico arquivado.",
            );
          }}
        />
      </>
    );
  }

  if (mode === "registration") {
    return (
      <div className="mt-4 space-y-4">
        <ul className="space-y-2">
          {registrations.map((reg) => (
            <li
              key={reg.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            >
              <div>
                <strong>{reg.registration_type}</strong> {reg.number}/{reg.state_uf} ·{" "}
                {reg.status}
                {reg.is_primary ? " · principal" : ""}
                {reg.consulted_at ? ` · consulta ${reg.consulted_at}` : ""}
                {reg.verification_status ? ` · ${reg.verification_status}` : ""}
              </div>
              <div className="flex gap-2">
                {!reg.is_primary ? (
                  <button
                    type="button"
                    className="text-xs text-[var(--accent)]"
                    disabled={pending}
                    onClick={() =>
                      run(
                        () => updateRegistrationAction(reg.id, { is_primary: true }),
                        "Marcado como principal.",
                      )
                    }
                  >
                    Tornar principal
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
        <div className="grid gap-2 md:grid-cols-3">
          <select
            className={fieldClass}
            value={regType}
            onChange={(e) => setRegType(e.target.value as "CRM" | "RQE")}
            aria-label="Tipo de registro"
          >
            <option value="CRM">CRM</option>
            <option value="RQE">RQE</option>
          </select>
          <input
            className={fieldClass}
            placeholder="Número"
            value={crmNumber}
            onChange={(e) => setCrmNumber(e.target.value)}
            aria-label="Número do registro"
          />
          <UfSelect id="reg_uf" value={crmUf} onChange={setCrmUf} />
          <select
            className={fieldClass}
            value={regStatus}
            onChange={(e) => setRegStatus(e.target.value)}
            aria-label="Situação"
          >
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
            <option value="suspenso">Suspenso</option>
            <option value="cancelado">Cancelado</option>
            <option value="desconhecido">Desconhecido</option>
          </select>
          <input
            type="date"
            className={fieldClass}
            value={consultedAt}
            onChange={(e) => setConsultedAt(e.target.value)}
            aria-label="Data da consulta"
          />
          <select
            className={fieldClass}
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
            aria-label="Fonte"
          >
            <option value="">Fonte</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {regType === "RQE" ? (
            <input
              className={fieldClass}
              placeholder="Área do RQE"
              value={rqeArea}
              onChange={(e) => setRqeArea(e.target.value)}
            />
          ) : null}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
            />
            Principal
          </label>
        </div>
        <button
          type="button"
          disabled={pending || !crmNumber}
          className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm text-white disabled:opacity-60"
          onClick={() =>
            run(
              () =>
                upsertRegistrationAction({
                  doctor_id: doctorId,
                  registration_type: regType,
                  number: crmNumber,
                  state_uf: crmUf,
                  status: regStatus,
                  is_primary: isPrimary,
                  source_id: sourceId || null,
                  consulted_at: consultedAt || null,
                  rqe_area: rqeArea || null,
                }),
              `${regType} adicionado.`,
            )
          }
        >
          Adicionar {regType}
        </button>
      </div>
    );
  }

  if (mode === "specialty") {
    return (
      <div className="mt-4 space-y-3">
        <div className="grid gap-2 md:grid-cols-2">
          <select
            className={fieldClass}
            value={specialtyId}
            onChange={(e) => setSpecialtyId(e.target.value)}
            aria-label="Especialidade"
          >
            <option value="">Selecione a especialidade</option>
            {specialties.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={0}
            max={100}
            className={fieldClass}
            value={specConfidence}
            onChange={(e) => setSpecConfidence(Number(e.target.value))}
            aria-label="Confiança"
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={specPrimary}
              onChange={(e) => setSpecPrimary(e.target.checked)}
            />
            Principal
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={specConfirmed}
              onChange={(e) => setSpecConfirmed(e.target.checked)}
            />
            Confirmada
          </label>
        </div>
        <button
          type="button"
          disabled={pending || !specialtyId}
          className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm text-white disabled:opacity-60"
          onClick={() =>
            run(
              () =>
                addDoctorSpecialtyAction({
                  doctor_id: doctorId,
                  specialty_id: specialtyId,
                  is_primary: specPrimary,
                  is_confirmed: specConfirmed,
                  confidence_score: specConfidence,
                  source_id: sourceId || null,
                }),
              "Especialidade vinculada.",
            )
          }
        >
          Adicionar especialidade
        </button>
      </div>
    );
  }

  if (mode === "link") {
    return (
      <div className="mt-4 space-y-4">
        <ul className="space-y-2">
          {links.map((link) => (
            <li
              key={link.id}
              className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <strong>{link.health_facilities?.name ?? link.facility_id}</strong>
                  <p className="text-[var(--muted)]">
                    {[link.function_title, link.role_title, link.practiced_specialty]
                      .filter(Boolean)
                      .join(" · ") || "Sem função"}
                    {link.is_coordinator ? " · Coordenador" : ""}
                    {link.is_team_leader ? " · Chefe de equipe" : ""}
                    {link.is_technical_responsible ? " · RT" : ""}
                    {link.is_clinical_staff ? " · Corpo clínico" : ""}
                    {link.is_sus_link ? " · SUS" : ""}
                    {link.weekly_hours != null ? ` · ${link.weekly_hours}h` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {link.status !== "encerrado" ? (
                    <button
                      type="button"
                      className="text-xs text-[var(--accent)]"
                      disabled={pending}
                      onClick={() =>
                        run(
                          () =>
                            updateLinkAction(link.id, {
                              status: "encerrado",
                              ended_on: new Date().toISOString().slice(0, 10),
                            }),
                          "Vínculo encerrado.",
                        )
                      }
                    >
                      Encerrar
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="text-xs text-rose-700"
                    disabled={pending}
                    onClick={() =>
                      run(() => archiveLinkAction(link.id), "Vínculo arquivado.")
                    }
                  >
                    Arquivar
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <div className="grid gap-2 md:grid-cols-2">
          <select
            className={fieldClass}
            value={facilityId}
            onChange={(e) => setFacilityId(e.target.value)}
            aria-label="Estabelecimento"
          >
            <option value="">Estabelecimento</option>
            {facilities.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.city}/{f.state_uf})
              </option>
            ))}
          </select>
          <input
            className={fieldClass}
            placeholder="Função"
            value={functionTitle}
            onChange={(e) => setFunctionTitle(e.target.value)}
          />
          <input
            className={fieldClass}
            placeholder="Cargo"
            value={roleTitle}
            onChange={(e) => setRoleTitle(e.target.value)}
          />
          <input
            className={fieldClass}
            placeholder="Especialidade exercida"
            value={practicedSpecialty}
            onChange={(e) => setPracticedSpecialty(e.target.value)}
          />
          <input
            className={fieldClass}
            placeholder="Carga horária semanal"
            type="number"
            value={weeklyHours}
            onChange={(e) => setWeeklyHours(e.target.value)}
          />
          <select
            className={fieldClass}
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
            aria-label="Fonte do vínculo"
          >
            <option value="">Fonte</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isCoordinator}
              onChange={(e) => setIsCoordinator(e.target.checked)}
            />
            Coordenador
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isTeamLeader}
              onChange={(e) => setIsTeamLeader(e.target.checked)}
            />
            Chefe de equipe
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isTechnical}
              onChange={(e) => setIsTechnical(e.target.checked)}
            />
            Responsável técnico
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isClinical}
              onChange={(e) => setIsClinical(e.target.checked)}
            />
            Corpo clínico
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isSusLink}
              onChange={(e) => setIsSusLink(e.target.checked)}
            />
            Vínculo SUS
          </label>
          {isCoordinator ? (
            <input
              className={`${fieldClass} md:col-span-2`}
              placeholder="Justificativa do coordenador"
              value={coordJustification}
              onChange={(e) => setCoordJustification(e.target.value)}
            />
          ) : null}
        </div>
        <button
          type="button"
          disabled={pending || !facilityId}
          className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm text-white disabled:opacity-60"
          onClick={() =>
            run(
              () =>
                createLinkAction({
                  doctor_id: doctorId,
                  facility_id: facilityId,
                  role_title: roleTitle || null,
                  function_title: functionTitle || null,
                  practiced_specialty: practicedSpecialty || null,
                  is_coordinator: isCoordinator,
                  is_team_leader: isTeamLeader,
                  is_technical_responsible: isTechnical,
                  is_clinical_staff: isClinical,
                  is_sus_link: isSusLink,
                  weekly_hours: weeklyHours ? Number(weeklyHours) : null,
                  coordinator_justification: coordJustification || null,
                  source_id: sourceId || null,
                  status: "provisorio",
                }),
              "Vínculo criado.",
            )
          }
        >
          Criar vínculo
        </button>
      </div>
    );
  }

  if (mode === "contact") {
    return (
      <div className="mt-4 space-y-4">
        <ul className="space-y-2">
          {contacts.map((contact) => (
            <li
              key={contact.id}
              className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-[var(--muted)]">
                    {CONTACT_CHANNEL_LABELS[contact.channel] ?? contact.channel}
                  </span>{" "}
                  {["telefone", "celular", "whatsapp"].includes(contact.channel)
                    ? formatPhoneDisplay(contact.value)
                    : contact.value}
                  {contact.is_primary ? " · principal" : ""}
                  {" · "}
                  {CONTACT_STATUS_LABELS[contact.contact_status] ?? contact.contact_status}
                  {contact.do_not_contact ? " · não contatar" : ""}
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {!contact.is_primary ? (
                    <button
                      type="button"
                      disabled={pending}
                      className="text-[var(--accent)]"
                      onClick={() =>
                        run(
                          () => updateContactAction(contact.id, { is_primary: true }),
                          "Contato marcado como principal.",
                        )
                      }
                    >
                      Principal
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={pending}
                    className="text-[var(--accent)]"
                    onClick={() =>
                      run(
                        () =>
                          updateContactAction(contact.id, {
                            contact_status: "valido" as ContactStatus,
                          }),
                        "Contato validado.",
                      )
                    }
                  >
                    Validar
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      run(
                        () =>
                          updateContactAction(contact.id, {
                            contact_status: "invalido",
                          }),
                        "Contato marcado inválido.",
                      )
                    }
                  >
                    Inválido
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      run(
                        () =>
                          updateContactAction(contact.id, {
                            contact_status: "desatualizado",
                          }),
                        "Contato desatualizado.",
                      )
                    }
                  >
                    Desatualizado
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      run(
                        () =>
                          markDoNotContactAction(
                            contact.id,
                            "Marcado pela equipe na ficha do médico",
                          ),
                        "Marcado como não contatar.",
                      )
                    }
                  >
                    Não contatar
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    className="text-rose-700"
                    onClick={() =>
                      run(
                        () => softDeleteContactAction(contact.id),
                        "Contato excluído logicamente.",
                      )
                    }
                  >
                    Excluir
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <div className="grid gap-2 md:grid-cols-3">
          <select
            className={fieldClass}
            value={contactChannel}
            onChange={(e) => setContactChannel(e.target.value as ContactChannel)}
            aria-label="Canal"
          >
            {Object.entries(CONTACT_CHANNEL_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {["telefone", "celular", "whatsapp"].includes(contactChannel) ? (
            <PhoneInput
              id="contact_value"
              label="Valor"
              value={contactValue}
              onChange={setContactValue}
            />
          ) : (
            <input
              className={fieldClass}
              placeholder="Valor"
              value={contactValue}
              onChange={(e) => setContactValue(e.target.value)}
              aria-label="Valor do contato"
            />
          )}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={contactPrimary}
              onChange={(e) => setContactPrimary(e.target.checked)}
            />
            Principal
          </label>
        </div>
        <button
          type="button"
          disabled={pending || !contactValue}
          className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm text-white disabled:opacity-60"
          onClick={() =>
            run(
              () =>
                createContactAction({
                  doctor_id: doctorId,
                  channel: contactChannel,
                  value: contactValue,
                  is_primary: contactPrimary,
                }),
              "Contato adicionado.",
            )
          }
        >
          Adicionar contato
        </button>
      </div>
    );
  }

  if (mode === "evidence") {
    return (
      <div className="mt-4 space-y-4">
        <ul className="space-y-2">
          {evidences.map((ev) => (
            <li
              key={ev.id}
              className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <strong>{ev.title}</strong>
                  {ev.confirmed_field ? (
                    <p className="text-[var(--muted)]">
                      Campo: {ev.confirmed_field}
                      {ev.captured_value ? ` = ${ev.captured_value}` : ""}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {ev.storage_path ? (
                    <button
                      type="button"
                      disabled={pending}
                      className="text-[var(--accent)]"
                      onClick={() =>
                        startTransition(async () => {
                          const result = await getEvidenceSignedUrlAction(ev.storage_path!);
                          if (!result.success) {
                            push(result.error.message, "error");
                            return;
                          }
                          window.open(result.data.url, "_blank", "noopener,noreferrer");
                        })
                      }
                    >
                      Ver arquivo
                    </button>
                  ) : null}
                  {ev.url ? (
                    <a
                      href={ev.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[var(--accent)]"
                    >
                      URL
                    </a>
                  ) : null}
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      run(() => decideEvidenceAction(ev.id, "aceita"), "Evidência aceita.")
                    }
                  >
                    Aceitar
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    className="text-rose-700"
                    onClick={() => {
                      const reason = window.prompt("Motivo da rejeição:");
                      if (!reason) return;
                      run(
                        () => decideEvidenceAction(ev.id, "rejeitada", reason),
                        "Evidência rejeitada.",
                      );
                    }}
                  >
                    Rejeitar
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <div className="grid gap-2 md:grid-cols-2">
          <input
            className={fieldClass}
            placeholder="Título"
            value={evidenceTitle}
            onChange={(e) => setEvidenceTitle(e.target.value)}
          />
          <input
            className={fieldClass}
            placeholder="Campo confirmado"
            value={evidenceField}
            onChange={(e) => setEvidenceField(e.target.value)}
          />
          <input
            className={fieldClass}
            placeholder="Valor encontrado"
            value={evidenceValue}
            onChange={(e) => setEvidenceValue(e.target.value)}
          />
          <input
            className={fieldClass}
            placeholder="URL"
            value={evidenceUrl}
            onChange={(e) => setEvidenceUrl(e.target.value)}
          />
          <select
            className={fieldClass}
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
            aria-label="Fonte da evidência"
          >
            <option value="">Fonte</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <input
            type="file"
            className={fieldClass}
            onChange={(e) => setEvidenceFile(e.target.files?.[0] ?? null)}
            aria-label="Arquivo de evidência"
          />
        </div>
        <button
          type="button"
          disabled={pending || !evidenceTitle}
          className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm text-white disabled:opacity-60"
          onClick={() =>
            startTransition(async () => {
              let storagePath: string | null = null;
              if (evidenceFile) {
                const supabase = createClient();
                const path = `${doctorId}/${Date.now()}-${evidenceFile.name}`;
                const { error } = await supabase.storage
                  .from("evidences")
                  .upload(path, evidenceFile, { upsert: false });
                if (error) {
                  push(`Falha no upload: ${error.message}`, "error");
                  return;
                }
                storagePath = path;
              }
              const result = await createEvidenceAction({
                entity_type: "doctor",
                entity_id: doctorId,
                title: evidenceTitle,
                confirmed_field: evidenceField || null,
                captured_value: evidenceValue || null,
                url: evidenceUrl || null,
                source_id: sourceId || null,
                storage_path: storagePath,
              });
              if (!result.success) {
                push(result.error.message, "error");
                return;
              }
              push("Evidência criada.", "success");
              setEvidenceTitle("");
              setEvidenceField("");
              setEvidenceValue("");
              setEvidenceUrl("");
              setEvidenceFile(null);
              router.refresh();
            })
          }
        >
          Adicionar evidência
        </button>
      </div>
    );
  }

  return null;
}

export function RemoveSpecialtyButton({ id }: { id: string }) {
  const router = useRouter();
  const { push } = useToast();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      className="text-xs text-rose-700"
      onClick={() =>
        startTransition(async () => {
          const result = await removeDoctorSpecialtyAction(id);
          if (!result.success) {
            push(result.error.message, "error");
            return;
          }
          push("Especialidade removida do médico.", "success");
          router.refresh();
        })
      }
    >
      Remover
    </button>
  );
}
