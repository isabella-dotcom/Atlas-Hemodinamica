"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";

const schema = z.object({
  name: z.string().min(3, "Informe o nome"),
  city: z.string().min(2, "Informe a cidade"),
  state_uf: z.string().length(2, "UF obrigatória"),
  cnes: z.string().optional(),
  cnpj: z.string().optional(),
  facility_type: z.string().optional(),
  has_hemodynamics: z.boolean(),
  attends_sus: z.enum(["unknown", "yes", "no"]),
  phone: z.string().optional(),
  website: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export function NewFacilityForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      state_uf: "MG",
      has_hemodynamics: true,
      attends_sus: "unknown",
    },
  });

  async function onSubmit(values: FormData) {
    setError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error: insertError } = await supabase
      .from("health_facilities")
      .insert({
        name: values.name.trim(),
        city: values.city.trim(),
        state_uf: values.state_uf.toUpperCase(),
        cnes: values.cnes || null,
        cnpj: values.cnpj || null,
        facility_type: values.facility_type || null,
        has_hemodynamics: values.has_hemodynamics,
        attends_sus:
          values.attends_sus === "unknown"
            ? null
            : values.attends_sus === "yes",
        phone: values.phone || null,
        website: values.website || null,
        notes: values.notes || null,
        layer: "candidato",
        confidence_score: 20,
        created_by: user?.id ?? null,
      })
      .select("id")
      .single();

    if (insertError || !data) {
      setError(insertError?.message ?? "Falha ao salvar estabelecimento.");
      return;
    }

    router.push(`/estabelecimentos/${data.id}`);
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="max-w-xl space-y-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5"
    >
      <div>
        <label className="mb-1.5 block text-sm">Nome</label>
        <input
          className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          {...register("name")}
        />
        {errors.name ? (
          <p className="mt-1 text-xs text-[var(--danger)]">
            {errors.name.message}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm">Cidade</label>
          <input
            className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            {...register("city")}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm">UF</label>
          <input
            maxLength={2}
            className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm uppercase"
            {...register("state_uf")}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm">CNES</label>
          <input
            className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            {...register("cnes")}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm">CNPJ</label>
          <input
            className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            {...register("cnpj")}
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm">Tipo</label>
        <input
          placeholder="Hospital, clínica, serviço…"
          className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          {...register("facility_type")}
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" {...register("has_hemodynamics")} />
        Possui serviço de hemodinâmica
      </label>

      <div>
        <label className="mb-1.5 block text-sm">Atende SUS</label>
        <select
          className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          {...register("attends_sus")}
        >
          <option value="unknown">Desconhecido</option>
          <option value="yes">Sim</option>
          <option value="no">Não</option>
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm">Telefone</label>
          <input
            className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            {...register("phone")}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm">Site</label>
          <input
            className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            {...register("website")}
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm">Observações</label>
        <textarea
          rows={3}
          className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          {...register("notes")}
        />
      </div>

      {error ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {isSubmitting ? "Salvando…" : "Salvar estabelecimento"}
      </button>
    </form>
  );
}
