import Link from "next/link";
import { PageHeader } from "@/components/ui/page";

export default function AcessoNegadoPage() {
  return (
    <div>
      <PageHeader
        title="Acesso negado"
        description="Você não possui permissão para acessar este recurso."
      />
      <Link href="/dashboard" className="text-sm text-[var(--accent)] hover:underline">
        Voltar ao dashboard
      </Link>
    </div>
  );
}
