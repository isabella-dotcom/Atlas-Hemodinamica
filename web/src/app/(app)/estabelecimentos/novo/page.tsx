import Link from "next/link";
import { NewFacilityForm } from "./new-facility-form";

export default function NovoEstabelecimentoPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/estabelecimentos"
          className="text-sm text-[var(--muted)] hover:text-[var(--accent)]"
        >
          ← Estabelecimentos
        </Link>
        <h2 className="mt-3 font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
          Novo estabelecimento
        </h2>
      </div>
      <NewFacilityForm />
    </div>
  );
}
