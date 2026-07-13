"use client";

import { useEffect, useState } from "react";
import type { AuditLog } from "@/types/database";

export function AuditDetail({
  row,
}: {
  row: AuditLog & { users_profile?: { full_name?: string } | null };
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <article className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-medium text-[var(--ink)]">{row.action}</p>
            <p className="text-xs text-[var(--muted)]">
              {row.users_profile?.full_name ?? "Usuário"} · {row.entity_type}
              {row.entity_id ? ` · ${row.entity_id.slice(0, 8)}` : ""} ·{" "}
              {new Date(row.created_at).toLocaleString("pt-BR")}
            </p>
          </div>
          <button
            type="button"
            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs"
            onClick={() => setOpen(true)}
          >
            Detalhe
          </button>
        </div>
      </article>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Detalhe da auditoria"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[80vh] w-full max-w-2xl overflow-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-medium">{row.action}</h3>
              <button type="button" className="text-sm text-[var(--muted)]" onClick={() => setOpen(false)}>
                Fechar
              </button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="mb-2 text-xs uppercase text-[var(--muted)]">Antes</p>
                <pre className="whitespace-pre-wrap rounded-md bg-[var(--surface-2)] p-3 text-xs">
                  {formatData(row.before_data)}
                </pre>
              </div>
              <div>
                <p className="mb-2 text-xs uppercase text-[var(--muted)]">Depois</p>
                <pre className="whitespace-pre-wrap rounded-md bg-[var(--surface-2)] p-3 text-xs">
                  {formatData(row.after_data)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function formatData(data: Record<string, unknown> | null): string {
  if (!data) return "—";
  return Object.entries(data)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join("\n");
}
