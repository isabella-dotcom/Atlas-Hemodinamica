"use client";

import { cn } from "@/lib/utils";
import { BRAZIL_UFS } from "@/lib/validation";
import { maskPhoneInput } from "@/lib/format";
import {
  CLASSIFICATION_LABELS,
  type DoctorClassification,
} from "@/types/database";

const fieldClass =
  "w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]";
const labelClass = "mb-1 block text-xs font-medium text-[var(--muted)]";

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-0", className)}>
      <label htmlFor={htmlFor} className={labelClass}>
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p> : null}
      {error ? (
        <p className="mt-1 text-xs text-rose-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TextInput({
  id,
  label,
  error,
  hint,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
}) {
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint}>
      <input id={id} className={cn(fieldClass, className)} {...props} />
    </Field>
  );
}

export function TextTextarea({
  id,
  label,
  error,
  hint,
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  error?: string;
  hint?: string;
}) {
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint}>
      <textarea id={id} className={cn(fieldClass, "min-h-24", className)} {...props} />
    </Field>
  );
}

export function FieldSelect({
  id,
  label,
  error,
  hint,
  children,
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
  hint?: string;
}) {
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint}>
      <select id={id} className={cn(fieldClass, className)} {...props}>
        {children}
      </select>
    </Field>
  );
}

export function UfSelect({
  id = "state_uf",
  label = "UF",
  value,
  onChange,
  name,
  required,
  error,
  allowEmpty,
}: {
  id?: string;
  label?: string;
  value?: string;
  onChange?: (value: string) => void;
  name?: string;
  required?: boolean;
  error?: string;
  allowEmpty?: boolean;
}) {
  return (
    <FieldSelect
      id={id}
      name={name}
      label={label}
      value={value}
      required={required}
      error={error}
      onChange={(e) => onChange?.(e.target.value)}
    >
      {allowEmpty ? <option value="">—</option> : null}
      {BRAZIL_UFS.map((uf) => (
        <option key={uf} value={uf}>
          {uf}
        </option>
      ))}
    </FieldSelect>
  );
}

export function PhoneInput({
  id,
  label,
  value,
  onChange,
  name,
  error,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  name?: string;
  error?: string;
  hint?: string;
}) {
  return (
    <TextInput
      id={id}
      name={name}
      label={label}
      value={maskPhoneInput(value)}
      onChange={(e) => onChange(maskPhoneInput(e.target.value))}
      error={error}
      hint={hint ?? "Exibido com máscara; salvo apenas com dígitos."}
      inputMode="tel"
      autoComplete="tel"
    />
  );
}

export function ConfidenceInput({
  id = "confidence_score",
  label = "Nível de confiança (0–100)",
  value,
  onChange,
  name,
  error,
}: {
  id?: string;
  label?: string;
  value: number;
  onChange?: (value: number) => void;
  name?: string;
  error?: string;
}) {
  return (
    <TextInput
      id={id}
      name={name}
      label={label}
      type="number"
      min={0}
      max={100}
      value={value}
      onChange={(e) => onChange?.(Number(e.target.value))}
      error={error}
    />
  );
}

export function ClassificationSelect({
  id = "classification",
  value,
  onChange,
  name,
  error,
  allowed,
}: {
  id?: string;
  value?: DoctorClassification;
  onChange?: (value: DoctorClassification) => void;
  name?: string;
  error?: string;
  allowed?: DoctorClassification[];
}) {
  const options = (allowed ?? (Object.keys(CLASSIFICATION_LABELS) as DoctorClassification[])).filter(
    (key) => CLASSIFICATION_LABELS[key],
  );
  return (
    <FieldSelect
      id={id}
      name={name}
      label="Classificação"
      value={value}
      error={error}
      onChange={(e) => onChange?.(e.target.value as DoctorClassification)}
    >
      {options.map((key) => (
        <option key={key} value={key}>
          {CLASSIFICATION_LABELS[key]}
        </option>
      ))}
    </FieldSelect>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  tone = "danger",
  onConfirm,
  onCancel,
  pending,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
  pending?: boolean;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <div className="w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-lg">
        <h3 id="confirm-title" className="text-base font-semibold text-[var(--ink)]">
          {title}
        </h3>
        {description ? (
          <p className="mt-2 text-sm text-[var(--muted)]">{description}</p>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            onClick={onCancel}
            disabled={pending}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={cn(
              "rounded-md px-3 py-2 text-sm text-white",
              tone === "danger" ? "bg-rose-700" : "bg-[var(--accent)]",
            )}
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? "Aguarde…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export { fieldClass, labelClass };
