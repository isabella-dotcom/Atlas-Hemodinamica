"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { createFacilityAction } from "@/services/facilities/mutations";
import { useToast } from "@/components/ui/toast";

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
  phone: z.string().optional(),
  email: z.string().optional(),
  website: z.string().optional(),
  address_street: z.string().optional(),
  address_number: z.string().optional(),
  address_district: z.string().optional(),
  address_zip: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;
const inputClass =
  "w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm";

export function NewFacilityForm() {
  const router = useRouter();
  const { push } = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      state_uf: "MG",
      has_hemodynamics: true,
      attends_sus: "unknown",
    },
  });

  function onSubmit(values: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createFacilityAction(values);
      if (!result.success) {
        setError(result.error.message);
        push(result.error.message, "error");
        return;
      }
      push("Estabelecimento criado.", "success");
      router.push(`/estabelecimentos/${result.data.id}`);
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="max-w-3xl space-y-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm">Razão social / nome *</label>
          <input className={inputClass} {...register("name")} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm">Nome fantasia</label>
          <input className={inputClass} {...register("trade_name")} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm">Cidade *</label>
          <input className={inputClass} {...register("city")} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm">UF *</label>
          <input maxLength={2} className={`${inputClass} uppercase`} {...register("state_uf")} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm">CNES</label>
          <input className={inputClass} {...register("cnes")} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm">CNPJ</label>
          <input className={inputClass} {...register("cnpj")} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm">Tipo</label>
          <input className={inputClass} placeholder="Hospital, clínica…" {...register("facility_type")} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm">Atende SUS</label>
          <select className={inputClass} {...register("attends_sus")}>
            <option value="unknown">Desconhecido</option>
            <option value="yes">Sim</option>
            <option value="no">Não</option>
          </select>
        </div>
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
      </div>
      <textarea rows={3} className={inputClass} placeholder="Observações" {...register("notes")} />
      {error ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>
      ) : null}
      <button type="submit" disabled={pending} className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm text-white disabled:opacity-60">
        {pending ? "Salvando…" : "Salvar estabelecimento"}
      </button>
    </form>
  );
}
