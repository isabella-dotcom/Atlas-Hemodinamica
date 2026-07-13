import { redirect, notFound } from "next/navigation";
import { PageHeader, ErrorState } from "@/components/ui/page";
import { getCurrentProfile } from "@/lib/data";
import { canWrite } from "@/lib/permissions";
import { getFacilityById } from "@/services/facilities/queries";
import { EditFacilityForm } from "./edit-facility-form";

export default async function EditarEstabelecimentoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!canWrite(profile?.role)) redirect("/acesso-negado");

  const { id } = await params;
  const result = await getFacilityById(id);
  if (!result.success) {
    if (result.error.code === "NOT_FOUND") notFound();
    return <ErrorState message={result.error.message} />;
  }

  return (
    <div>
      <PageHeader
        title="Editar estabelecimento"
        description={result.data.name}
        breadcrumbs={[
          { label: "Estabelecimentos", href: "/estabelecimentos" },
          { label: result.data.name, href: `/estabelecimentos/${id}` },
          { label: "Editar" },
        ]}
      />
      <EditFacilityForm facility={result.data} />
    </div>
  );
}
