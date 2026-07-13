"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { updateFacilityAction } from "@/services/facilities/mutations";
import { useToast } from "@/components/ui/toast";
import type { HealthFacility } from "@/types/database";

const schema = z.object({
  name: z.string().min(3),
  trade_name: z.string().optional(),
  city: z.string().min(2),
  state_uf: z.string().length(2),
  cnes: z.string().optional(),
  cnpj: z.string().optional(),
  facility_type: z.string().optional(),
  has_hemodynamics: z.boolean(),
  attends_sus: z.enum(["unknown", "yes", "no"]),
  service_status: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  website: z.string().optional(),
  address_street: z.string().optional(),
  address_number: z.string().optional(),
  address_district: z.string().optional(),
  address_zip: z.string().optional(),
  last_validated_at: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;
const inputClass =
  "w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm";

export function EditFacilityForm({ facility }: { facility: HealthFacility }) {
  const router = useRouter();
  const { push } = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: facility.name,
      trade_name: facility.trade_name ?? "",
      city: facility.city,
      state_uf: facility.state_uf,
      cnes: facility.cnes ?? "",
      cnpj: facility.cnpj ?? "",
      facility_type: facility.facility_type ?? "",
      has_hemodynamics: facility.has_hemodynamics,
      attends_sus:
        facility.attends_sus == null
          ? "unknown"
          : facility.attends_sus
            ? "yes"
            : "no",
      service_status: facility.service_status ?? "desconhecido",
      phone: facility.phone ?? "",
      email: facility.email ?? "",
      website: facility.website ?? "",
      address_street: facility.address_street ?? "",
      address_number: facility.address_number ?? "",
      address_district: facility.address_district ?? "",
      address_zip: facility.address_zip ?? "",
      last_validated_at: facility.last_validated_at
        ? facility.last_validated_at.slice(0, 16)
        : "",
      notes: facility.notes ?? "",
    },
  });

  function onSubmit(values: FormData) {
    setError(null);
    startTransition(async () => {
      const payload = {
        ...values,
        last_validated_at: values.last_validated_at
          ? new Date(values.last_validated_at).toISOString()
          : "",
      };
      const result = await updateFacilityAction(facility.id, payload);
      if (!result.success) {
        setError(result.error.message);
        push(result.error.message, "error");
        return;
      }
      push("Estabelecimento atualizado com sucesso.", "success");
      router.push(`/estabelecimentos/${facility.id}`);
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="max-w-3xl space-y-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Razão social / nome *">
          <input className={inputClass} {...register("name")} />
        </Field>
        <Field label="Nome fantasia">
          <input className={inputClass} {...register("trade_name")} />
        </Field>
        <Field label="Cidade *">
          <input className={inputClass} {...register("city")} />
        </Field>
        <Field label="UF *">
          <input maxLength={2} className={`${inputClass} uppercase`} {...register("state_uf")} />
        </Field>
        <Field label="CNES">
          <input className={inputClass} {...register("cnes")} />
        </Field>
        <Field label="CNPJ">
          <input className={inputClass} {...register("cnpj")} />
        </Field>
        <Field label="Tipo">
          <input className={inputClass} {...register("facility_type")} />
        </Field>
        <Field label="Status do serviço">
          <input className={inputClass} {...register("service_status")} />
        </Field>
        <Field label="Atende SUS">
          <select className={inputClass} {...register("attends_sus")}>
            <option value="unknown">Desconhecido</option>
            <option value="yes">Sim</option>
            <option value="no">Não</option>
          </select>
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" {...register("has_hemodynamics")} />
        Possui serviço de hemodinâmica
      </label>
      <div className="grid gap-4 md:grid-cols-2">
        <input className={inputClass} placeholder="Logradouro" {...register("address_street")} />
        <input className={inputClass} placeholder="Número" {...register("address_number")} />
        <input className={inputClass} placeholder="Bairro" {...register("address_district")} />
        <input className={inputClass} placeholder="CEP" {...register("address_zip")} />
        <input className={inputClass} placeholder="Telefone" {...register("phone")} />
        <input className={inputClass} placeholder="E-mail" {...register("email")} />
        <input className={inputClass} placeholder="Site" {...register("website")} />
        <Field label="Última validação">
          <input
            type="datetime-local"
            className={inputClass}
            {...register("last_validated_at")}
          />
        </Field>
      </div>
      <p className="text-xs text-[var(--muted)]">
        O schema atual não possui campos separados de natureza jurídica, região ou
        atividade; use tipo, cidade/UF e observações quando necessário.
      </p>
      <textarea rows={3} className={inputClass} placeholder="Observações" {...register("notes")} />
      {error ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm text-white disabled:opacity-60"
        >
          {pending ? "Salvando…" : "Salvar alterações"}
        </button>
        <button
          type="button"
          disabled={pending}
          className="rounded-md border border-[var(--border)] px-4 py-2 text-sm"
          onClick={() => router.push(`/estabelecimentos/${facility.id}`)}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm">{label}</label>
      {children}
    </div>
  );
}
