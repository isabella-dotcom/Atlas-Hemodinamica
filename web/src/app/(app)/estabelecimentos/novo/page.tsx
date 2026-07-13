import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page";
import { getCurrentProfile } from "@/lib/data";
import { canWrite } from "@/lib/permissions";
import { NewFacilityForm } from "./new-facility-form";

export default async function NovoEstabelecimentoPage() {
  const profile = await getCurrentProfile();
  if (!canWrite(profile?.role)) redirect("/acesso-negado");

  return (
    <div>
      <PageHeader
        title="Novo estabelecimento"
        breadcrumbs={[
          { label: "Estabelecimentos", href: "/estabelecimentos" },
          { label: "Novo" },
        ]}
      />
      <NewFacilityForm />
    </div>
  );
}
