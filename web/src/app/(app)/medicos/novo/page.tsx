import Link from "next/link";
import { NewDoctorForm } from "./new-doctor-form";

export default function NovoMedicoPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/medicos"
          className="text-sm text-[var(--muted)] hover:text-[var(--accent)]"
        >
          ← Médicos
        </Link>
        <h2 className="mt-3 font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
          Novo médico candidato
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Cardiologista encontrado em fonte pública não é automaticamente
          hemodinamicista.
        </p>
      </div>
      <NewDoctorForm />
    </div>
  );
}
