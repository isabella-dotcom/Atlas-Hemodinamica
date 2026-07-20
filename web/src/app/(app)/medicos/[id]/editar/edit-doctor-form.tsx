"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateDoctorAction } from "@/services/doctors/mutations";
import { doctorUpdateSchema } from "@/services/doctors/schemas";
import { useToast } from "@/components/ui/toast";
import {
  ClassificationSelect,
  ConfidenceInput,
  FieldSelect,
  TextInput,
  TextTextarea,
  UfSelect,
} from "@/components/form-fields";
import {
  VALIDATION_STATUS_LABELS,
  type Doctor,
  type DoctorClassification,
  type ValidationStatus,
} from "@/types/database";

function joinList(values: string[] | null | undefined): string {
  return (values ?? []).join(", ");
}

export function EditDoctorForm({ doctor }: { doctor: Doctor }) {
  const router = useRouter();
  const { push } = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const [fullName, setFullName] = useState(doctor.full_name);
  const [socialName, setSocialName] = useState(doctor.social_name ?? "");
  const [sex, setSex] = useState(doctor.sex ?? "");
  const [birthDate, setBirthDate] = useState(doctor.birth_date ?? "");
  const [nationality, setNationality] = useState(doctor.nationality ?? "");
  const [biography, setBiography] = useState(doctor.biography ?? "");
  const [city, setCity] = useState(doctor.city ?? "");
  const [stateUf, setStateUf] = useState(doctor.state_uf ?? "MG");
  const [classification, setClassification] = useState<DoctorClassification>(
    doctor.classification,
  );
  const [validationStatus, setValidationStatus] = useState<ValidationStatus>(
    doctor.validation_status,
  );
  const [confidence, setConfidence] = useState(doctor.confidence_score);
  const [notes, setNotes] = useState(doctor.notes ?? "");
  const [declaredArea, setDeclaredArea] = useState(doctor.declared_practice_area ?? "");
  const [confirmedArea, setConfirmedArea] = useState(doctor.confirmed_practice_area ?? "");
  const [keywords, setKeywords] = useState(joinList(doctor.practice_keywords));
  const [gradInst, setGradInst] = useState(doctor.graduation_institution ?? "");
  const [gradYear, setGradYear] = useState(doctor.graduation_year?.toString() ?? "");
  const [residency, setResidency] = useState(doctor.residency ?? "");
  const [specialization, setSpecialization] = useState(doctor.specialization ?? "");
  const [fellowships, setFellowships] = useState(joinList(doctor.fellowships));
  const [masters, setMasters] = useState(doctor.masters_degree ?? "");
  const [doctorate, setDoctorate] = useState(doctor.doctorate_degree ?? "");
  const [titles, setTitles] = useState(joinList(doctor.professional_titles));
  const [societies, setSocieties] = useState(joinList(doctor.medical_societies));
  const [sbhci, setSbhci] = useState(
    doctor.is_sbhci_member === true ? "yes" : doctor.is_sbhci_member === false ? "no" : "",
  );
  const [lattes, setLattes] = useState(doctor.lattes_url ?? "");
  const [orcid, setOrcid] = useState(doctor.orcid ?? "");

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const parsed = doctorUpdateSchema.safeParse({
      full_name: fullName,
      social_name: socialName,
      sex: sex || null,
      birth_date: birthDate || null,
      nationality,
      biography,
      city,
      state_uf: stateUf,
      classification,
      validation_status: validationStatus,
      confidence_score: confidence,
      notes,
      declared_practice_area: declaredArea,
      confirmed_practice_area: confirmedArea,
      practice_keywords: keywords,
      graduation_institution: gradInst,
      graduation_year: gradYear || null,
      residency,
      specialization,
      fellowships,
      masters_degree: masters,
      doctorate_degree: doctorate,
      professional_titles: titles,
      medical_societies: societies,
      is_sbhci_member: sbhci === "yes" ? true : sbhci === "no" ? false : null,
      lattes_url: lattes,
      orcid,
    });
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Dados inválidos.";
      setError(message);
      push(message, "error");
      return;
    }
    startTransition(async () => {
      const result = await updateDoctorAction(doctor.id, parsed.data);
      if (!result.success) {
        setError(result.error.message);
        push(result.error.message, "error");
        return;
      }
      setDirty(false);
      push("Médico atualizado com sucesso.", "success");
      router.push(`/medicos/${doctor.id}`);
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
        <h3 className="md:col-span-2 text-sm font-medium">Dados básicos</h3>
        <TextInput id="full_name" label="Nome completo *" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <TextInput id="social_name" label="Nome social" value={socialName} onChange={(e) => setSocialName(e.target.value)} />
        <FieldSelect id="sex" label="Sexo" value={sex} onChange={(e) => setSex(e.target.value)}>
          <option value="">Não informado</option>
          <option value="F">Feminino</option>
          <option value="M">Masculino</option>
          <option value="X">Outro</option>
          <option value="NI">Não informado</option>
        </FieldSelect>
        <TextInput id="birth_date" label="Data de nascimento" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
        <TextInput id="nationality" label="Nacionalidade" value={nationality} onChange={(e) => setNationality(e.target.value)} />
        <TextInput id="city" label="Cidade *" value={city} onChange={(e) => setCity(e.target.value)} />
        <UfSelect id="state_uf" value={stateUf} onChange={setStateUf} />
        <ClassificationSelect value={classification} onChange={setClassification} />
        <FieldSelect
          id="validation_status"
          label="Status de validação"
          value={validationStatus}
          onChange={(e) => setValidationStatus(e.target.value as ValidationStatus)}
        >
          {Object.entries(VALIDATION_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </FieldSelect>
        <ConfidenceInput value={confidence} onChange={setConfidence} />
        <TextTextarea id="biography" label="Biografia / resumo" className="md:col-span-2" value={biography} onChange={(e) => setBiography(e.target.value)} />
        <TextTextarea id="notes" label="Observações internas" className="md:col-span-2" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </section>

      <section className="grid gap-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 md:grid-cols-2">
        <h3 className="md:col-span-2 text-sm font-medium">Atuação e formação</h3>
        <TextInput id="declared_practice_area" label="Área de atuação declarada" value={declaredArea} onChange={(e) => setDeclaredArea(e.target.value)} />
        <TextInput id="confirmed_practice_area" label="Área de atuação confirmada" value={confirmedArea} onChange={(e) => setConfirmedArea(e.target.value)} />
        <TextInput id="practice_keywords" label="Palavras-chave (vírgula)" value={keywords} onChange={(e) => setKeywords(e.target.value)} />
        <TextInput id="graduation_institution" label="Instituição de graduação" value={gradInst} onChange={(e) => setGradInst(e.target.value)} />
        <TextInput id="graduation_year" label="Ano de graduação" type="number" value={gradYear} onChange={(e) => setGradYear(e.target.value)} />
        <TextInput id="residency" label="Residência médica" value={residency} onChange={(e) => setResidency(e.target.value)} />
        <TextInput id="specialization" label="Especialização" value={specialization} onChange={(e) => setSpecialization(e.target.value)} />
        <TextInput id="fellowships" label="Fellowships (vírgula)" value={fellowships} onChange={(e) => setFellowships(e.target.value)} />
        <TextInput id="masters_degree" label="Mestrado" value={masters} onChange={(e) => setMasters(e.target.value)} />
        <TextInput id="doctorate_degree" label="Doutorado" value={doctorate} onChange={(e) => setDoctorate(e.target.value)} />
        <TextInput id="professional_titles" label="Títulos (vírgula)" value={titles} onChange={(e) => setTitles(e.target.value)} />
        <TextInput id="medical_societies" label="Sociedades (vírgula)" value={societies} onChange={(e) => setSocieties(e.target.value)} />
        <FieldSelect id="is_sbhci_member" label="Membro SBHCI" value={sbhci} onChange={(e) => setSbhci(e.target.value)}>
          <option value="">Não informado</option>
          <option value="yes">Sim</option>
          <option value="no">Não</option>
        </FieldSelect>
        <TextInput id="lattes_url" label="Currículo Lattes (URL)" value={lattes} onChange={(e) => setLattes(e.target.value)} />
        <TextInput id="orcid" label="ORCID" placeholder="0000-0000-0000-0000" value={orcid} onChange={(e) => setOrcid(e.target.value)} />
      </section>

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "Salvando…" : "Salvar alterações"}
        </button>
        <button
          type="button"
          className="rounded-md border border-[var(--border)] px-4 py-2 text-sm"
          onClick={() => {
            if (dirty && !window.confirm("Há alterações não salvas. Deseja sair?")) return;
            router.push(`/medicos/${doctor.id}`);
          }}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
