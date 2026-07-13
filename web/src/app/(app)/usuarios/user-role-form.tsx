"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateUserRoleAction } from "@/services/users/mutations";
import { useToast } from "@/components/ui/toast";
import type { AppRole } from "@/types/database";

export function UserRoleForm({
  userId,
  role,
  isActive,
}: {
  userId: string;
  role: AppRole;
  isActive: boolean;
}) {
  const router = useRouter();
  const { push } = useToast();
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        startTransition(async () => {
          const result = await updateUserRoleAction({
            userId,
            role: form.get("role") as AppRole,
            isActive: form.get("is_active") === "on",
          });
          if (!result.success) {
            push(result.error.message, "error");
            return;
          }
          push("Perfil atualizado.", "success");
          router.refresh();
        });
      }}
    >
      <select
        name="role"
        defaultValue={role}
        className="rounded-md border border-[var(--border)] px-2 py-1 text-xs"
      >
        <option value="visualizador">Visualizador</option>
        <option value="analista">Analista</option>
        <option value="master">Master</option>
      </select>
      <label className="flex items-center gap-1 text-xs">
        <input type="checkbox" name="is_active" defaultChecked={isActive} />
        Ativo
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-[var(--border)] px-2 py-1 text-xs disabled:opacity-60"
      >
        Salvar
      </button>
    </form>
  );
}
