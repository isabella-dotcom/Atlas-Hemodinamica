import { cn } from "@/lib/utils";
import type {
  DoctorClassification,
  EvidenceStatus,
  RecordLayer,
  ReviewStatus,
  ValidationStatus,
} from "@/types/database";
import {
  CLASSIFICATION_LABELS,
  EVIDENCE_STATUS_LABELS,
  LAYER_LABELS,
  REVIEW_STATUS_LABELS,
  VALIDATION_STATUS_LABELS,
} from "@/types/database";
import { confidenceBand } from "@/lib/format";

const classificationTone: Record<DoctorClassification, string> = {
  possivel_candidato: "bg-amber-50 text-amber-900 border-amber-200",
  atuacao_provavel: "bg-sky-50 text-sky-900 border-sky-200",
  atuacao_institucional_confirmada: "bg-teal-50 text-teal-900 border-teal-200",
  especialista_confirmado: "bg-emerald-50 text-emerald-900 border-emerald-200",
  rejeitado: "bg-rose-50 text-rose-900 border-rose-200",
  inativo: "bg-slate-100 text-slate-700 border-slate-200",
  falecido: "bg-stone-100 text-stone-800 border-stone-300",
  registro_duplicado: "bg-orange-50 text-orange-900 border-orange-200",
};

export function ClassificationBadge({ value }: { value: DoctorClassification }) {
  return (
    <span className={cn("inline-flex rounded border px-2 py-0.5 text-xs", classificationTone[value])}>
      {CLASSIFICATION_LABELS[value]}
    </span>
  );
}

export function ValidationBadge({ value }: { value: ValidationStatus }) {
  return (
    <span className="inline-flex rounded border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 text-xs text-[var(--ink-soft)]">
      {VALIDATION_STATUS_LABELS[value]}
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

export function ReviewBadge({ value }: { value: ReviewStatus }) {
  return (
    <span className="inline-flex rounded border border-[var(--border)] px-2 py-0.5 text-xs">
      {REVIEW_STATUS_LABELS[value]}
    </span>
  );
}

export function EvidenceBadge({ value }: { value: EvidenceStatus }) {
  return (
    <span className="inline-flex rounded border border-[var(--border)] px-2 py-0.5 text-xs">
      {EVIDENCE_STATUS_LABELS[value]}
    </span>
  );
}

export function ConfidenceBadge({ score }: { score: number }) {
  return (
    <span
      title={confidenceBand(score)}
      className="inline-flex items-center gap-2 text-xs text-[var(--ink-soft)]"
    >
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--surface-2)]">
        <span
          className="block h-full rounded-full bg-[var(--accent)]"
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </span>
      <span className="tabular-nums">{score}%</span>
    </span>
  );
}

/** @deprecated use ConfidenceBadge */
export function ConfidenceBar({ score }: { score: number }) {
  return <ConfidenceBadge score={score} />;
}
