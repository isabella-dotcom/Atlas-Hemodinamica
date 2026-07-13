"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  archiveDoctorAction,
  restoreDoctorAction,
  sendDoctorToReviewAction,
  upsertRegistrationAction,
} from "@/services/doctors/mutations";
import {
  createContactAction,
  createEvidenceAction,
  createLinkAction,
} from "@/services/links-contacts-evidences/mutations";
import { useToast } from "@/components/ui/toast";

const inputClass =
  "w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm";

export function DoctorActionsPanel({
  doctorId,
  isArchived,
  mode,
  facilities = [],
  sources = [],
}: {
  doctorId: string;
  isArchived: boolean;
  mode: "header" | "registration" | "link" | "contact" | "evidence";
  facilities?: { id: string; name: string; city: string; state_uf: string }[];
  sources?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const { push } = useToast();
  const [pending, startTransition] = useTransition();
  const [crmNumber, setCrmNumber] = useState("");
  const [crmUf, setCrmUf] = useState("MG");
  const [regType, setRegType] = useState<"CRM" | "RQE">("CRM");
  const [facilityId, setFacilityId] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [isCoordinator, setIsCoordinator] = useState(false);
  const [coordJustification, setCoordJustification] = useState("");
  const [contactChannel, setContactChannel] = useState<"email" | "telefone" | "whatsapp" | "site" | "outro">("email");
  const [contactValue, setContactValue] = useState("");
  const [evidenceTitle, setEvidenceTitle] = useState("");
  const [evidenceField, setEvidenceField] = useState("");
  const [sourceId, setSourceId] = useState("");

  function run(action: () => Promise<{ success: boolean; error?: { message: string } }>, okMsg: string) {
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
      <div className="flex flex-wrap gap-2">
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
            onClick={() =>
              run(() => archiveDoctorAction(doctorId, "Arquivado pela equipe"), "Médico arquivado.")
            }
          >
            Arquivar
          </button>
        )}
      </div>
    );
  }

  if (mode === "registration") {
    return (
      <form
        className="mt-4 grid gap-3 md:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () =>
              upsertRegistrationAction({
                doctor_id: doctorId,
                registration_type: regType,
                number: crmNumber,
                state_uf: crmUf,
                status: "desconhecido",
                is_primary: regType === "CRM",
                source_id: sourceId || null,
                confidence_score: 20,
              }),
            "Registro profissional salvo.",
          );
        }}
      >
        <select className={inputClass} value={regType} onChange={(e) => setRegType(e.target.value as "CRM" | "RQE")}>
          <option value="CRM">CRM</option>
          <option value="RQE">RQE</option>
        </select>
        <input className={inputClass} placeholder="Número" value={crmNumber} onChange={(e) => setCrmNumber(e.target.value)} required />
        <input className={`${inputClass} uppercase`} maxLength={2} placeholder="UF" value={crmUf} onChange={(e) => setCrmUf(e.target.value)} required />
        <button type="submit" disabled={pending} className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm text-white disabled:opacity-60">
          Adicionar
        </button>
      </form>
    );
  }

  if (mode === "link") {
    return (
      <form
        className="mt-4 grid gap-3 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () =>
              createLinkAction({
                doctor_id: doctorId,
                facility_id: facilityId,
                role_title: roleTitle || null,
                is_coordinator: isCoordinator,
                coordinator_justification: coordJustification || null,
                coordinator_confirmed: false,
                status: "provisorio",
                source_id: sourceId || null,
                confidence_score: 30,
                layer: "candidato",
              }),
            "Vínculo criado.",
          );
        }}
      >
        <select className={inputClass} value={facilityId} onChange={(e) => setFacilityId(e.target.value)} required>
          <option value="">Estabelecimento</option>
          {facilities.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        <input className={inputClass} placeholder="Cargo" value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isCoordinator} onChange={(e) => setIsCoordinator(e.target.checked)} />
          Coordenador (provável — exige fonte para confirmar)
        </label>
        {isCoordinator ? (
          <input
            className={inputClass}
            placeholder="Justificativa do coordenador"
            value={coordJustification}
            onChange={(e) => setCoordJustification(e.target.value)}
          />
        ) : null}
        <select className={inputClass} value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
          <option value="">Fonte</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button type="submit" disabled={pending || !facilityId} className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm text-white disabled:opacity-60">
          Vincular
        </button>
      </form>
    );
  }

  if (mode === "contact") {
    return (
      <form
        className="mt-4 grid gap-3 md:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () =>
              createContactAction({
                doctor_id: doctorId,
                channel: contactChannel,
                value: contactValue,
                is_institutional: true,
                is_primary: false,
                do_not_contact: false,
                source_id: sourceId || null,
                confidence_score: 40,
              }),
            "Contato adicionado.",
          );
        }}
      >
        <select className={inputClass} value={contactChannel} onChange={(e) => setContactChannel(e.target.value as typeof contactChannel)}>
          <option value="email">E-mail</option>
          <option value="telefone">Telefone</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="site">Site</option>
          <option value="outro">Outro</option>
        </select>
        <input className={inputClass} placeholder="Valor" value={contactValue} onChange={(e) => setContactValue(e.target.value)} required />
        <button type="submit" disabled={pending} className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm text-white disabled:opacity-60">
          Adicionar contato
        </button>
      </form>
    );
  }

  return (
    <form
      className="mt-4 grid gap-3 md:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () =>
            createEvidenceAction({
              entity_type: "doctor",
              entity_id: doctorId,
              title: evidenceTitle,
              confirmed_field: evidenceField || null,
              source_id: sourceId || null,
              status: "pendente",
            }),
          "Evidência registrada.",
        );
      }}
    >
      <input className={inputClass} placeholder="Título" value={evidenceTitle} onChange={(e) => setEvidenceTitle(e.target.value)} required />
      <input className={inputClass} placeholder="Campo confirmado" value={evidenceField} onChange={(e) => setEvidenceField(e.target.value)} />
      <select className={inputClass} value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
        <option value="">Fonte</option>
        {sources.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <button type="submit" disabled={pending} className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm text-white disabled:opacity-60">
        Adicionar evidência
      </button>
    </form>
  );
}
