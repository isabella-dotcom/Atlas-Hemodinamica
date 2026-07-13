"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import { normalizePersonName } from "@/lib/utils";

const schema = z.object({
  full_name: z.string().min(3, "Informe o nome completo"),
  city: z.string().optional(),
  state_uf: z
    .string()
    .length(2, "UF com 2 letras")
    .or(z.literal(""))
    .optional(),
  crm_number: z.string().optional(),
  crm_uf: z.string().length(2).or(z.literal("")).optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export function NewDoctorForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { state_uf: "MG", crm_uf: "MG" },
  });

  async function onSubmit(values: FormData) {
    setError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: doctor, error: doctorError } = await supabase
      .from("doctors")
      .insert({
        full_name: values.full_name.trim(),
        normalized_name: normalizePersonName(values.full_name),
        city: values.city || null,
        state_uf: values.state_uf?.toUpperCase() || null,
        notes: values.notes || null,
        classification: "possivel_candidato",
        layer: "candidato",
        confidence_score: 10,
        created_by: user?.id ?? null,
      })
      .select("id")
      .single();

    if (doctorError || !doctor) {
      setError(
        doctorError?.message ??
          "Falha ao criar médico. Verifique permissões e schema.",
      );
      return;
    }

    if (values.crm_number && values.crm_uf) {
      const { error: crmError } = await supabase
        .from("medical_registrations")
        .insert({
          doctor_id: doctor.id,
          registration_type: "CRM",
          number: values.crm_number.trim(),
          state_uf: values.crm_uf.toUpperCase(),
          status: "desconhecido",
          confidence_score: 20,
          is_primary: true,
        });

      if (crmError) {
        setError(
          `Médico criado, mas CRM não foi salvo: ${crmError.message}`,
        );
        router.push(`/medicos/${doctor.id}`);
        return;
      }
    }

    await supabase.from("review_queue").insert({
      doctor_id: doctor.id,
      status: "pendente",
      priority: 50,
      notes: "Cadastro manual — aguardando validação humana",
    });

    router.push(`/medicos/${doctor.id}`);
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="max-w-xl space-y-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5"
    >
      <Field label="Nome completo" error={errors.full_name?.message}>
        <input
          className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          {...register("full_name")}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Cidade">
          <input
            className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            {...register("city")}
          />
        </Field>
        <Field label="UF" error={errors.state_uf?.message}>
          <input
            maxLength={2}
            className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm uppercase"
            {...register("state_uf")}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="CRM (número)">
          <input
            className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            {...register("crm_number")}
          />
        </Field>
        <Field label="CRM UF">
          <input
            maxLength={2}
            className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm uppercase"
            {...register("crm_uf")}
          />
        </Field>
      </div>

      <Field label="Observações">
        <textarea
          rows={3}
          className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          {...register("notes")}
        />
      </Field>

      {error ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      <p className="text-xs text-[var(--muted)]">
        O registro entra como candidato e gera item na fila de validação. Não
        vai para a base oficial automaticamente.
      </p>

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
      >
        {isSubmitting ? "Salvando…" : "Salvar candidato"}
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
      <label className="mb-1.5 block text-sm text-[var(--ink-soft)]">
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-[var(--danger)]">{error}</p>
      ) : null}
    </div>
  );
}
