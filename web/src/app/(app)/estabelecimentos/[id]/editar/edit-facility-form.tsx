"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateFacilityAction } from "@/services/facilities/mutations";
import { boolToTriState, facilityUpdateSchema } from "@/services/facilities/schemas";
import { useToast } from "@/components/ui/toast";
import {
  ConfidenceInput,
  FieldSelect,
  PhoneInput,
  TextInput,
  TextTextarea,
  UfSelect,
} from "@/components/form-fields";
import { OWNERSHIP_TYPE_LABELS, type HealthFacility } from "@/types/database";
import { formatPhoneDisplay } from "@/lib/format";

export function EditFacilityForm({ facility }: { facility: HealthFacility }) {
  const router = useRouter();
  const { push } = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const [form, setForm] = useState({
    name: facility.name,
    trade_name: facility.trade_name ?? "",
    city: facility.city,
    state_uf: facility.state_uf,
    cnes: facility.cnes ?? "",
    cnpj: facility.cnpj ?? "",
    facility_type: facility.facility_type ?? "",
    legal_nature: facility.legal_nature ?? "",
    ownership_type: facility.ownership_type ?? "",
    branch_type: facility.branch_type ?? "",
    is_active: facility.is_active ?? true,
    has_hemodynamics: facility.has_hemodynamics,
    attends_sus: boolToTriState(facility.attends_sus),
    attends_private: boolToTriState(facility.attends_private),
    attends_insurance: boolToTriState(facility.attends_insurance),
    service_status: facility.service_status ?? "desconhecido",
    phone: facility.phone ? formatPhoneDisplay(facility.phone) : "",
    email: facility.email ?? "",
    website: facility.website ?? "",
    hemodynamics_phone: facility.hemodynamics_phone
      ? formatPhoneDisplay(facility.hemodynamics_phone)
      : "",
    institutional_whatsapp: facility.institutional_whatsapp
      ? formatPhoneDisplay(facility.institutional_whatsapp)
      : "",
    hemodynamics_email: facility.hemodynamics_email ?? "",
    secretary_contact: facility.secretary_contact ?? "",
    service_manager_contact: facility.service_manager_contact ?? "",
    address_street: facility.address_street ?? "",
    address_number: facility.address_number ?? "",
    address_complement: facility.address_complement ?? "",
    address_district: facility.address_district ?? "",
    address_zip: facility.address_zip ?? "",
    ibge_city_code: facility.ibge_city_code ?? "",
    region: facility.region ?? "",
    latitude: facility.latitude?.toString() ?? "",
    longitude: facility.longitude?.toString() ?? "",
    has_catheterization_lab: facility.has_catheterization_lab ?? false,
    has_interventional_cardiology: facility.has_interventional_cardiology ?? false,
    has_interventional_radiology: facility.has_interventional_radiology ?? false,
    has_interventional_neuroradiology:
      facility.has_interventional_neuroradiology ?? false,
    is_24_hours: facility.is_24_hours ?? false,
    has_emergency_service: facility.has_emergency_service ?? false,
    estimated_rooms: facility.estimated_rooms?.toString() ?? "",
    estimated_equipment: facility.estimated_equipment?.toString() ?? "",
    procedures: facility.procedures ?? "",
    service_notes: facility.service_notes ?? "",
    last_service_confirmed_at: facility.last_service_confirmed_at
      ? facility.last_service_confirmed_at.slice(0, 16)
      : "",
    notes: facility.notes ?? "",
    confidence_score: facility.confidence_score,
  });

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function patch<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setDirty(true);
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const parsed = facilityUpdateSchema.safeParse({
      ...form,
      ownership_type: form.ownership_type || null,
      branch_type: form.branch_type || null,
      latitude: form.latitude || null,
      longitude: form.longitude || null,
      estimated_rooms: form.estimated_rooms || null,
      estimated_equipment: form.estimated_equipment || null,
      last_service_confirmed_at: form.last_service_confirmed_at
        ? new Date(form.last_service_confirmed_at).toISOString()
        : null,
    });
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Dados inválidos.";
      setError(message);
      push(message, "error");
      return;
    }
    startTransition(async () => {
      const result = await updateFacilityAction(facility.id, parsed.data);
      if (!result.success) {
        setError(result.error.message);
        push(result.error.message, "error");
        return;
      }
      setDirty(false);
      push("Estabelecimento atualizado.", "success");
      router.push(`/estabelecimentos/${facility.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} onChange={() => setDirty(true)} className="space-y-6">
      {error ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
          {error}
        </p>
      ) : null}

      <section className="grid gap-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 md:grid-cols-2">
        <h3 className="md:col-span-2 text-sm font-medium">Identificação</h3>
        <TextInput id="name" label="Razão social *" value={form.name} onChange={(e) => patch("name", e.target.value)} />
        <TextInput id="trade_name" label="Nome fantasia" value={form.trade_name} onChange={(e) => patch("trade_name", e.target.value)} />
        <TextInput id="cnes" label="CNES" value={form.cnes} onChange={(e) => patch("cnes", e.target.value)} />
        <TextInput id="cnpj" label="CNPJ" value={form.cnpj} onChange={(e) => patch("cnpj", e.target.value)} />
        <TextInput id="facility_type" label="Tipo" value={form.facility_type} onChange={(e) => patch("facility_type", e.target.value)} />
        <TextInput id="legal_nature" label="Natureza jurídica" value={form.legal_nature} onChange={(e) => patch("legal_nature", e.target.value)} />
        <FieldSelect id="ownership_type" label="Público/privado" value={form.ownership_type} onChange={(e) => patch("ownership_type", e.target.value)}>
          <option value="">Não informado</option>
          {Object.entries(OWNERSHIP_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </FieldSelect>
        <FieldSelect id="branch_type" label="Matriz / filial" value={form.branch_type} onChange={(e) => patch("branch_type", e.target.value)}>
          <option value="">Não informado</option>
          <option value="matriz">Matriz</option>
          <option value="filial">Filial</option>
          <option value="unico">Único</option>
        </FieldSelect>
        <label className="flex items-center gap-2 text-sm md:col-span-2">
          <input type="checkbox" checked={form.is_active} onChange={(e) => patch("is_active", e.target.checked)} />
          Ativo
        </label>
      </section>

      <section className="grid gap-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 md:grid-cols-2">
        <h3 className="md:col-span-2 text-sm font-medium">Localização</h3>
        <TextInput id="city" label="Município *" value={form.city} onChange={(e) => patch("city", e.target.value)} />
        <UfSelect value={form.state_uf} onChange={(v) => patch("state_uf", v)} />
        <TextInput id="address_zip" label="CEP" value={form.address_zip} onChange={(e) => patch("address_zip", e.target.value)} />
        <TextInput id="address_street" label="Logradouro" value={form.address_street} onChange={(e) => patch("address_street", e.target.value)} />
        <TextInput id="address_number" label="Número" value={form.address_number} onChange={(e) => patch("address_number", e.target.value)} />
        <TextInput id="address_complement" label="Complemento" value={form.address_complement} onChange={(e) => patch("address_complement", e.target.value)} />
        <TextInput id="address_district" label="Bairro" value={form.address_district} onChange={(e) => patch("address_district", e.target.value)} />
        <TextInput id="ibge_city_code" label="Código IBGE" value={form.ibge_city_code} onChange={(e) => patch("ibge_city_code", e.target.value)} />
        <TextInput id="region" label="Região" value={form.region} onChange={(e) => patch("region", e.target.value)} />
        <TextInput id="latitude" label="Latitude" value={form.latitude} onChange={(e) => patch("latitude", e.target.value)} />
        <TextInput id="longitude" label="Longitude" value={form.longitude} onChange={(e) => patch("longitude", e.target.value)} />
      </section>

      <section className="grid gap-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 md:grid-cols-2">
        <h3 className="md:col-span-2 text-sm font-medium">Contatos institucionais</h3>
        <PhoneInput id="phone" label="Telefone geral" value={form.phone} onChange={(v) => patch("phone", v)} />
        <PhoneInput id="hemodynamics_phone" label="Telefone da hemodinâmica" value={form.hemodynamics_phone} onChange={(v) => patch("hemodynamics_phone", v)} />
        <PhoneInput id="institutional_whatsapp" label="WhatsApp institucional" value={form.institutional_whatsapp} onChange={(v) => patch("institutional_whatsapp", v)} />
        <TextInput id="email" label="E-mail geral" value={form.email} onChange={(e) => patch("email", e.target.value)} />
        <TextInput id="hemodynamics_email" label="E-mail da hemodinâmica" value={form.hemodynamics_email} onChange={(e) => patch("hemodynamics_email", e.target.value)} />
        <TextInput id="website" label="Site" value={form.website} onChange={(e) => patch("website", e.target.value)} />
        <TextInput id="secretary_contact" label="Contato da secretaria" value={form.secretary_contact} onChange={(e) => patch("secretary_contact", e.target.value)} />
        <TextInput id="service_manager_contact" label="Responsável pelo serviço" value={form.service_manager_contact} onChange={(e) => patch("service_manager_contact", e.target.value)} />
      </section>

      <section className="grid gap-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 md:grid-cols-2">
        <h3 className="md:col-span-2 text-sm font-medium">Serviço de hemodinâmica</h3>
        {(
          [
            ["has_hemodynamics", "Possui hemodinâmica"],
            ["has_catheterization_lab", "Laboratório de cateterismo"],
            ["has_interventional_cardiology", "Cardiologia intervencionista"],
            ["has_interventional_radiology", "Radiologia intervencionista"],
            ["has_interventional_neuroradiology", "Neurorradiologia intervencionista"],
            ["is_24_hours", "Funcionamento 24 horas"],
            ["has_emergency_service", "Urgência e emergência"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(form[key])}
              onChange={(e) => patch(key, e.target.checked)}
            />
            {label}
          </label>
        ))}
        <FieldSelect id="attends_sus" label="Atende SUS" value={form.attends_sus} onChange={(e) => patch("attends_sus", e.target.value as typeof form.attends_sus)}>
          <option value="unknown">Não informado</option>
          <option value="yes">Sim</option>
          <option value="no">Não</option>
        </FieldSelect>
        <FieldSelect id="attends_private" label="Particular" value={form.attends_private} onChange={(e) => patch("attends_private", e.target.value as typeof form.attends_private)}>
          <option value="unknown">Não informado</option>
          <option value="yes">Sim</option>
          <option value="no">Não</option>
        </FieldSelect>
        <FieldSelect id="attends_insurance" label="Convênios" value={form.attends_insurance} onChange={(e) => patch("attends_insurance", e.target.value as typeof form.attends_insurance)}>
          <option value="unknown">Não informado</option>
          <option value="yes">Sim</option>
          <option value="no">Não</option>
        </FieldSelect>
        <TextInput id="estimated_rooms" label="Salas (estimativa)" type="number" value={form.estimated_rooms} onChange={(e) => patch("estimated_rooms", e.target.value)} />
        <TextInput id="estimated_equipment" label="Equipamentos (estimativa)" type="number" value={form.estimated_equipment} onChange={(e) => patch("estimated_equipment", e.target.value)} />
        <TextInput id="service_status" label="Status do serviço" value={form.service_status} onChange={(e) => patch("service_status", e.target.value)} />
        <TextInput id="last_service_confirmed_at" label="Última confirmação do serviço" type="datetime-local" value={form.last_service_confirmed_at} onChange={(e) => patch("last_service_confirmed_at", e.target.value)} />
        <ConfidenceInput value={form.confidence_score} onChange={(v) => patch("confidence_score", v)} />
        <TextTextarea id="procedures" label="Procedimentos" className="md:col-span-2" value={form.procedures} onChange={(e) => patch("procedures", e.target.value)} />
        <TextTextarea id="service_notes" label="Observações do serviço" className="md:col-span-2" value={form.service_notes} onChange={(e) => patch("service_notes", e.target.value)} />
        <TextTextarea id="notes" label="Observações gerais" className="md:col-span-2" value={form.notes} onChange={(e) => patch("notes", e.target.value)} />
      </section>

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
          {pending ? "Salvando…" : "Salvar alterações"}
        </button>
        <button
          type="button"
          className="rounded-md border border-[var(--border)] px-4 py-2 text-sm"
          onClick={() => {
            if (dirty && !window.confirm("Há alterações não salvas. Deseja sair?")) return;
            router.push(`/estabelecimentos/${facility.id}`);
          }}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
