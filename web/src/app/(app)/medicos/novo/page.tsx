import { redirect } from "next/navigation";
import { PageHeader, ErrorState } from "@/components/ui/page";
import { getCurrentProfile } from "@/lib/data";
import { canWrite } from "@/lib/permissions";
import { listSpecialties } from "@/services/doctors/queries";
import { listFacilitiesForSelect } from "@/services/facilities/queries";
import { NewDoctorForm } from "./new-doctor-form";

export default async function NovoMedicoPage() {
  const profile = await getCurrentProfile();
  if (!canWrite(profile?.role)) redirect("/acesso-negado");

  const [specialties, facilities] = await Promise.all([
    listSpecialties(),
    listFacilitiesForSelect(),
  ]);

  if (!specialties.success) {
    return (
      <div className="space-y-4">
        <PageHeader title="Novo médico candidato" />
        <ErrorState message={specialties.error.message} />
      </div>
    );
  }

  if (!facilities.success) {
    return (
      <div className="space-y-4">
        <PageHeader title="Novo médico candidato" />
        <ErrorState message={facilities.error.message} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Novo médico candidato"
        description="Cardiologista em fonte pública não é automaticamente hemodinamicista."
        breadcrumbs={[
          { label: "Médicos", href: "/medicos" },
          { label: "Novo" },
        ]}
      />
      <NewDoctorForm
        specialties={specialties.data}
        facilities={facilities.data}
      />
    </div>
  );
}
