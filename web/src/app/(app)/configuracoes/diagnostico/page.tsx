import { redirect } from "next/navigation";
import { DiagnosticPanel } from "./diagnostic-panel";
import { runFoundationDiagnostic } from "@/lib/diagnostics";
import { getCurrentProfile } from "@/lib/data";

export default async function DiagnosticoPage() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "master") {
    redirect("/dashboard");
  }

  const report = await runFoundationDiagnostic();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
          Diagnóstico técnico
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Visível somente para Master. Nenhum segredo é exibido.
        </p>
      </div>
      <DiagnosticPanel initialReport={report} />
    </div>
  );
}
