import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page";
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
        specialties={specialties.success ? specialties.data : []}
        facilities={facilities.success ? facilities.data : []}
      />
    </div>
  );
}
