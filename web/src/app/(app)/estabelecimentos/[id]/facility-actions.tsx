"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { archiveFacilityAction } from "@/services/facilities/mutations";
import { useToast } from "@/components/ui/toast";

export function FacilityActions({ facilityId }: { facilityId: string }) {
  const router = useRouter();
  const { push } = useToast();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 disabled:opacity-60"
      onClick={() => {
        startTransition(async () => {
          const result = await archiveFacilityAction(facilityId, "Arquivado");
          if (!result.success) {
            push(result.error.message, "error");
            return;
          }
          push("Estabelecimento arquivado.", "success");
          router.push("/estabelecimentos");
          router.refresh();
        });
      }}
    >
      Arquivar
    </button>
  );
}
