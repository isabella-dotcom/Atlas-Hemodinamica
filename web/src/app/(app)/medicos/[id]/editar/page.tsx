import { notFound, redirect } from "next/navigation";
import { PageHeader, ErrorState } from "@/components/ui/page";
import { getCurrentProfile } from "@/lib/data";
import { canWrite } from "@/lib/permissions";
import { getDoctorById } from "@/services/doctors/queries";
import { EditDoctorForm } from "./edit-doctor-form";

export default async function EditarMedicoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!canWrite(profile?.role)) {
    redirect("/acesso-negado");
  }

  const result = await getDoctorById(id);
  if (!result.success) {
    if (result.error.code === "NOT_FOUND") notFound();
    return <ErrorState message={result.error.message} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Editar médico"
        description={result.data.full_name}
        breadcrumbs={[
          { label: "Médicos", href: "/medicos" },
          { label: result.data.full_name, href: `/medicos/${id}` },
          { label: "Editar" },
        ]}
      />
      <EditDoctorForm doctor={result.data} />
    </div>
  );
}
