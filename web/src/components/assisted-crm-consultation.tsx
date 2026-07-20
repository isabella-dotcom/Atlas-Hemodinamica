"use client";

import { useState, useTransition } from "react";
import { registerCrmConsultationAction } from "@/services/ingestion/mutations";
import { useToast } from "@/components/ui/toast";

const CFM_URL = "https://portal.cfm.org.br/busca-medicos";

export function AssistedCrmConsultation({ doctorId }: { doctorId: string }) {
  const { push } = useToast();
  const [pending, startTransition] = useTransition();
  const [crm, setCrm] = useState("");
  const [uf, setUf] = useState("MG");
  const [status, setStatus] = useState("ativo");
  const [rqe, setRqe] = useState("");
  const [rqeArea, setRqeArea] = useState("");
  const [notes, setNotes] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");

  function submit() {
    startTransition(async () => {
      const result = await registerCrmConsultationAction({
        doctor_id: doctorId,
        crm_number: crm,
        state_uf: uf,
        status,
        rqe_number: rqe || undefined,
        rqe_area: rqeArea || undefined,
        notes,
        evidence_url: evidenceUrl || undefined,
      });
      if (!result.success) {
        push(result.error.message, "error");
        return;
      }
      push("Consulta assistida registrada.", "success");
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">Validação assistida CRM/RQE</h3>
        <a
          href={CFM_URL}
          target="_blank"
          rel="noreferrer"
          className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs"
        >
          Consultar no CFM
        </a>
      </div>
      <p className="text-xs text-[var(--muted)]">
        Sem scraping. Abra a consulta oficial, registre o resultado e anexe evidência.
      </p>
      <div className="grid gap-2 md:grid-cols-3">
        <input
          className="rounded-md border border-[var(--border)] px-2 py-1.5 text-sm"
          placeholder="CRM"
          value={crm}
          onChange={(e) => setCrm(e.target.value)}
        />
        <input
          className="rounded-md border border-[var(--border)] px-2 py-1.5 text-sm"
          placeholder="UF"
          maxLength={2}
          value={uf}
          onChange={(e) => setUf(e.target.value.toUpperCase())}
        />
        <input
          className="rounded-md border border-[var(--border)] px-2 py-1.5 text-sm"
          placeholder="Situação"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        />
        <input
          className="rounded-md border border-[var(--border)] px-2 py-1.5 text-sm"
          placeholder="RQE (opcional)"
          value={rqe}
          onChange={(e) => setRqe(e.target.value)}
        />
        <input
          className="rounded-md border border-[var(--border)] px-2 py-1.5 text-sm"
          placeholder="Área RQE"
          value={rqeArea}
          onChange={(e) => setRqeArea(e.target.value)}
        />
        <input
          className="rounded-md border border-[var(--border)] px-2 py-1.5 text-sm"
          placeholder="URL evidência"
          value={evidenceUrl}
          onChange={(e) => setEvidenceUrl(e.target.value)}
        />
      </div>
      <textarea
        className="w-full rounded-md border border-[var(--border)] px-2 py-1.5 text-sm"
        placeholder="Observações da consulta"
        rows={2}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <button
        type="button"
        disabled={pending || !crm || !uf}
        className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm text-white disabled:opacity-60"
        onClick={submit}
      >
        Registrar resultado
      </button>
    </div>
  );
}
