import { cn } from "@/lib/utils";
import type { DoctorClassification, RecordLayer } from "@/types/database";
import { CLASSIFICATION_LABELS, LAYER_LABELS } from "@/types/database";

const classificationTone: Record<DoctorClassification, string> = {
  possivel_candidato: "bg-amber-50 text-amber-900 border-amber-200",
  atuacao_provavel: "bg-sky-50 text-sky-900 border-sky-200",
  atuacao_institucional_confirmada:
    "bg-teal-50 text-teal-900 border-teal-200",
  especialista_confirmado: "bg-emerald-50 text-emerald-900 border-emerald-200",
  rejeitado: "bg-rose-50 text-rose-900 border-rose-200",
  inativo: "bg-slate-100 text-slate-700 border-slate-200",
};

export function ClassificationBadge({
  value,
}: {
  value: DoctorClassification;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded border px-2 py-0.5 text-xs",
        classificationTone[value],
      )}
    >
      {CLASSIFICATION_LABELS[value]}
    </span>
  );
}

export function LayerBadge({ value }: { value: RecordLayer }) {
  return (
    <span className="inline-flex rounded border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 text-xs text-[var(--ink-soft)]">
      {LAYER_LABELS[value]}
    </span>
  );
}

export function ConfidenceBar({ score }: { score: number }) {
  return (
    <div className="flex min-w-24 items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-2)]">
        <div
          className="h-full rounded-full bg-[var(--accent)]"
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-[var(--muted)]">{score}%</span>
    </div>
  );
}
