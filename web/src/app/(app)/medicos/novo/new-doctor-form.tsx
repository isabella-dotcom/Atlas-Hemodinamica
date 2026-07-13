"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { createDoctorAction } from "@/services/doctors/mutations";
import { useToast } from "@/components/ui/toast";

const formSchema = z.object({
  full_name: z.string().trim().min(3, "Informe o nome completo"),
  city: z.string().trim().min(2, "Informe a cidade"),
  state_uf: z.string().trim().length(2, "UF com 2 letras"),
  classification: z.enum(["possivel_candidato", "atuacao_provavel"]),
  validation_status: z.enum(["nao_iniciada", "em_revisao"]),
  confidence_score: z.number().int().min(0).max(100),
  notes: z.string().optional(),
  crm_number: z.string().optional(),
  crm_uf: z.string().optional(),
  crm_status: z
    .enum(["ativo", "inativo", "suspenso", "cancelado", "desconhecido"])
    .optional(),
  rqe_number: z.string().optional(),
  rqe_uf: z.string().optional(),
  specialty_id: z.string().optional(),
  facility_id: z.string().optional(),
  role_title: z.string().optional(),
  department: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

const inputClass =
  "w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm";

export function NewDoctorForm({
  specialties,
  facilities,
}: {
  specialties: { id: string; name: string }[];
  facilities: { id: string; name: string; city: string; state_uf: string }[];
}) {
  const router = useRouter();
  const { push } = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      state_uf: "MG",
      classification: "possivel_candidato",
      validation_status: "nao_iniciada",
      confidence_score: 10,
      crm_uf: "MG",
      rqe_uf: "MG",
    },
  });

  function onSubmit(values: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createDoctorAction(values);
      if (!result.success) {
        setError(result.error.message);
        push(result.error.message, "error");
        return;
      }
      push("Médico candidato criado com sucesso.", "success");
      router.push(`/medicos/${result.data.id}`);
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="max-w-3xl space-y-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Nome completo *" error={errors.full_name?.message}>
          <input className={inputClass} {...register("full_name")} />
        </Field>
        <Field label="Confiança inicial">
          <input
            type="number"
            min={0}
            max={100}
            className={inputClass}
            {...register("confidence_score", { valueAsNumber: true })}
          />
        </Field>
        <Field label="Cidade *" error={errors.city?.message}>
          <input className={inputClass} {...register("city")} />
        </Field>
        <Field label="UF *" error={errors.state_uf?.message}>
          <input maxLength={2} className={`${inputClass} uppercase`} {...register("state_uf")} />
        </Field>
        <Field label="Classificação">
          <select className={inputClass} {...register("classification")}>
            <option value="possivel_candidato">Possível candidato</option>
            <option value="atuacao_provavel">Atuação provável</option>
          </select>
        </Field>
        <Field label="Status de validação">
          <select className={inputClass} {...register("validation_status")}>
            <option value="nao_iniciada">Não iniciada</option>
            <option value="em_revisao">Em revisão</option>
          </select>
        </Field>
      </div>

      <fieldset className="grid gap-4 rounded-md border border-[var(--border)] p-4 md:grid-cols-3">
        <legend className="px-1 text-sm font-medium">CRM (opcional)</legend>
        <Field label="Número">
          <input className={inputClass} {...register("crm_number")} />
        </Field>
        <Field label="UF">
          <input maxLength={2} className={`${inputClass} uppercase`} {...register("crm_uf")} />
        </Field>
        <Field label="Situação">
          <select className={inputClass} {...register("crm_status")}>
            <option value="desconhecido">Desconhecido</option>
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
            <option value="suspenso">Suspenso</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </Field>
      </fieldset>

      <fieldset className="grid gap-4 rounded-md border border-[var(--border)] p-4 md:grid-cols-3">
        <legend className="px-1 text-sm font-medium">RQE (opcional)</legend>
        <Field label="Número">
          <input className={inputClass} {...register("rqe_number")} />
        </Field>
        <Field label="UF">
          <input maxLength={2} className={`${inputClass} uppercase`} {...register("rqe_uf")} />
        </Field>
        <Field label="Especialidade">
          <select className={inputClass} {...register("specialty_id")}>
            <option value="">Selecionar</option>
            {specialties.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
      </fieldset>

      <fieldset className="grid gap-4 rounded-md border border-[var(--border)] p-4 md:grid-cols-2">
        <legend className="px-1 text-sm font-medium">Vínculo inicial (opcional)</legend>
        <Field label="Estabelecimento">
          <select className={inputClass} {...register("facility_id")}>
            <option value="">Não vincular agora</option>
            {facilities.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} · {f.city}/{f.state_uf}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Cargo">
          <input className={inputClass} {...register("role_title")} />
        </Field>
        <Field label="Departamento">
          <input className={inputClass} {...register("department")} />
        </Field>
      </fieldset>

      <Field label="Observações">
        <textarea rows={3} className={inputClass} {...register("notes")} />
      </Field>

      {error ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      <p className="text-xs text-[var(--muted)]">
        O registro entra como candidato e gera item na fila. Não há aprovação automática.
      </p>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "Salvando…" : "Salvar candidato"}
      </button>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm text-[var(--ink-soft)]">{label}</label>
      {children}
      {error ? <p className="mt-1 text-xs text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}
