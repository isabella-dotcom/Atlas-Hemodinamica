"use client";

import { useState, useTransition } from "react";
import {
  acceptSourceObservationAction,
  createFieldOverrideAction,
} from "@/services/ingestion/mutations";
import { useToast } from "@/components/ui/toast";

type Obs = {
  id: string;
  field_name: string;
  observed_value: unknown;
  competence: string | null;
  observed_at: string;
  confidence_score: number;
};

type Override = {
  id: string;
  field_name: string;
  override_value: unknown;
  reason: string;
  overridden_at: string;
};

export function SourceProvenancePanel({
  entityType,
  entityId,
  autoExtracted,
  primarySourceCode,
  sourceCompetence,
  lastSyncedAt,
  observations,
  overrides,
}: {
  entityType: "doctor" | "facility";
  entityId: string;
  autoExtracted?: boolean;
  primarySourceCode?: string | null;
  sourceCompetence?: string | null;
  lastSyncedAt?: string | null;
  observations: Obs[];
  overrides: Override[];
}) {
  const { push } = useToast();
  const [pending, startTransition] = useTransition();
  const [field, setField] = useState("phone");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");

  function saveOverride() {
    startTransition(async () => {
      const result = await createFieldOverrideAction({
        entity_type: entityType,
        entity_id: entityId,
        field_name: field,
        override_value: value,
        reason,
      });
      if (!result.success) {
        push(result.error.message, "error");
        return;
      }
      push("Override salvo — próximas sincronizações não sobrescrevem este campo.", "success");
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-sm">
      <h3 className="font-medium">Origem e sincronização</h3>
      <dl className="grid gap-2 sm:grid-cols-2 text-xs">
        <div>
          <dt className="text-[var(--muted)]">Extraído automaticamente</dt>
          <dd>{autoExtracted ? "Sim" : "Não"}</dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">Fonte principal</dt>
          <dd>{primarySourceCode || "—"}</dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">Competência</dt>
          <dd>{sourceCompetence || "—"}</dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">Última sincronização</dt>
          <dd>
            {lastSyncedAt ? new Date(lastSyncedAt).toLocaleString("pt-BR") : "—"}
          </dd>
        </div>
      </dl>

      <h4 className="text-xs font-medium">Overrides ativos</h4>
      {overrides.length === 0 ? (
        <p className="text-xs text-[var(--muted)]">Nenhum.</p>
      ) : (
        <ul className="space-y-1 text-xs">
          {overrides.map((o) => (
            <li key={o.id}>
              {o.field_name}: {JSON.stringify(o.override_value)} — {o.reason}
            </li>
          ))}
        </ul>
      )}

      <h4 className="text-xs font-medium">Últimas observações da fonte</h4>
      {observations.length === 0 ? (
        <p className="text-xs text-[var(--muted)]">Nenhuma.</p>
      ) : (
        <ul className="space-y-2 text-xs">
          {observations.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {o.field_name}: {JSON.stringify(o.observed_value)} ({o.competence || "—"})
              </span>
              <button
                type="button"
                disabled={pending}
                className="rounded border border-[var(--border)] px-2 py-0.5"
                onClick={() =>
                  startTransition(async () => {
                    const result = await acceptSourceObservationAction({
                      observation_id: o.id,
                      entity_type: entityType,
                      entity_id: entityId,
                      field_name: o.field_name,
                    });
                    if (!result.success) push(result.error.message, "error");
                    else push("Valor da fonte aceito (override removido).", "success");
                  })
                }
              >
                Aceitar fonte
              </button>
            </li>
          ))}
        </ul>
      )}

      <h4 className="text-xs font-medium">Criar override manual</h4>
      <div className="grid gap-2 md:grid-cols-3">
        <input
          className="rounded-md border border-[var(--border)] px-2 py-1 text-xs"
          value={field}
          onChange={(e) => setField(e.target.value)}
          placeholder="campo"
        />
        <input
          className="rounded-md border border-[var(--border)] px-2 py-1 text-xs"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="valor"
        />
        <input
          className="rounded-md border border-[var(--border)] px-2 py-1 text-xs"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="justificativa"
        />
      </div>
      <button
        type="button"
        disabled={pending || !reason}
        className="rounded-md border border-[var(--border)] px-3 py-1 text-xs"
        onClick={saveOverride}
      >
        Manter valor manual
      </button>
    </div>
  );
}
