"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createContactAction,
  createEvidenceAction,
  createLinkAction,
  decideEvidenceAction,
  getEvidenceSignedUrlAction,
  softDeleteContactAction,
  updateContactAction,
} from "@/services/links-contacts-evidences/mutations";
import { useToast } from "@/components/ui/toast";
import { PhoneInput, fieldClass } from "@/components/form-fields";
import { createClient } from "@/lib/supabase/client";
import {
  CONTACT_CHANNEL_LABELS,
  CONTACT_STATUS_LABELS,
  type ContactChannel,
  type Evidence,
  type ProfessionalContact,
} from "@/types/database";
import { formatPhoneDisplay } from "@/lib/format";

export function FacilityEntityPanels({
  facilityId,
  mode,
  contacts = [],
  evidences = [],
  doctors = [],
  sources = [],
}: {
  facilityId: string;
  mode: "contact" | "evidence" | "link";
  contacts?: ProfessionalContact[];
  evidences?: Evidence[];
  doctors?: { id: string; full_name: string }[];
  sources?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const { push } = useToast();
  const [pending, startTransition] = useTransition();

  const [channel, setChannel] = useState<ContactChannel>("telefone");
  const [value, setValue] = useState("");
  const [title, setTitle] = useState("");
  const [field, setField] = useState("");
  const [captured, setCaptured] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sourceId, setSourceId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [roleTitle, setRoleTitle] = useState("");

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

  if (mode === "contact") {
    return (
      <div className="space-y-4">
        <ul className="space-y-2">
          {contacts.map((contact) => (
            <li
              key={contact.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            >
              <span>
                {CONTACT_CHANNEL_LABELS[contact.channel] ?? contact.channel}:{" "}
                {["telefone", "celular", "whatsapp"].includes(contact.channel)
                  ? formatPhoneDisplay(contact.value)
                  : contact.value}{" "}
                · {CONTACT_STATUS_LABELS[contact.contact_status] ?? contact.contact_status}
              </span>
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run(
                      () =>
                        updateContactAction(contact.id, { contact_status: "valido" }),
                      "Contato validado.",
                    )
                  }
                >
                  Validar
                </button>
                <button
                  type="button"
                  disabled={pending}
                  className="text-rose-700"
                  onClick={() =>
                    run(() => softDeleteContactAction(contact.id), "Contato excluído.")
                  }
                >
                  Excluir
                </button>
              </div>
            </li>
          ))}
        </ul>
        <div className="grid gap-2 md:grid-cols-3">
          <select
            className={fieldClass}
            value={channel}
            onChange={(e) => setChannel(e.target.value as ContactChannel)}
            aria-label="Canal"
          >
            {Object.entries(CONTACT_CHANNEL_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
          {["telefone", "celular", "whatsapp"].includes(channel) ? (
            <PhoneInput id="fac_contact" label="Valor" value={value} onChange={setValue} />
          ) : (
            <input
              className={fieldClass}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Valor"
              aria-label="Valor"
            />
          )}
          <button
            type="button"
            disabled={pending || !value}
            className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm text-white disabled:opacity-60"
            onClick={() =>
              run(
                () =>
                  createContactAction({
                    facility_id: facilityId,
                    channel,
                    value,
                  }),
                "Contato adicionado.",
              )
            }
          >
            Adicionar
          </button>
        </div>
      </div>
    );
  }

  if (mode === "evidence") {
    return (
      <div className="space-y-4">
        <ul className="space-y-2">
          {evidences.map((ev) => (
            <li
              key={ev.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            >
              <span>{ev.title}</span>
              <div className="flex gap-2 text-xs">
                {ev.storage_path ? (
                  <button
                    type="button"
                    disabled={pending}
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
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run(() => decideEvidenceAction(ev.id, "aceita"), "Evidência aceita.")
                  }
                >
                  Aceitar
                </button>
              </div>
            </li>
          ))}
        </ul>
        <div className="grid gap-2 md:grid-cols-2">
          <input
            className={fieldClass}
            placeholder="Título"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input
            className={fieldClass}
            placeholder="Campo confirmado"
            value={field}
            onChange={(e) => setField(e.target.value)}
          />
          <input
            className={fieldClass}
            placeholder="Valor encontrado"
            value={captured}
            onChange={(e) => setCaptured(e.target.value)}
          />
          <input
            className={fieldClass}
            placeholder="URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
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
          <input
            type="file"
            className={fieldClass}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <button
          type="button"
          disabled={pending || !title}
          className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm text-white disabled:opacity-60"
          onClick={() =>
            startTransition(async () => {
              let storagePath: string | null = null;
              if (file) {
                const supabase = createClient();
                const path = `facilities/${facilityId}/${Date.now()}-${file.name}`;
                const { error } = await supabase.storage
                  .from("evidences")
                  .upload(path, file, { upsert: false });
                if (error) {
                  push(`Falha no upload: ${error.message}`, "error");
                  return;
                }
                storagePath = path;
              }
              const result = await createEvidenceAction({
                entity_type: "facility",
                entity_id: facilityId,
                title,
                confirmed_field: field || null,
                captured_value: captured || null,
                url: url || null,
                source_id: sourceId || null,
                storage_path: storagePath,
              });
              if (!result.success) {
                push(result.error.message, "error");
                return;
              }
              push("Evidência criada.", "success");
              router.refresh();
            })
          }
        >
          Adicionar evidência
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 grid gap-2 md:grid-cols-3">
      <select
        className={fieldClass}
        value={doctorId}
        onChange={(e) => setDoctorId(e.target.value)}
        aria-label="Médico"
      >
        <option value="">Médico</option>
        {doctors.map((d) => (
          <option key={d.id} value={d.id}>
            {d.full_name}
          </option>
        ))}
      </select>
      <input
        className={fieldClass}
        placeholder="Cargo / função"
        value={roleTitle}
        onChange={(e) => setRoleTitle(e.target.value)}
      />
      <button
        type="button"
        disabled={pending || !doctorId}
        className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm text-white disabled:opacity-60"
        onClick={() =>
          run(
            () =>
              createLinkAction({
                doctor_id: doctorId,
                facility_id: facilityId,
                role_title: roleTitle || null,
                status: "provisorio",
              }),
            "Vínculo criado.",
          )
        }
      >
        Vincular médico
      </button>
    </div>
  );
}
