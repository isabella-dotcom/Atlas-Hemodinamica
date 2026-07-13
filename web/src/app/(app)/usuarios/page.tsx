import { redirect } from "next/navigation";
import { PageHeader, EmptyState, ErrorState } from "@/components/ui/page";
import { getCurrentProfile } from "@/lib/data";
import { canManageUsers } from "@/lib/permissions";
import { listUsers } from "@/services/dashboard/queries";
import { ROLE_LABELS } from "@/types/database";
import { UserRoleForm } from "./user-role-form";

export default async function UsuariosPage() {
  const profile = await getCurrentProfile();
  if (!canManageUsers(profile?.role)) redirect("/acesso-negado");

  const result = await listUsers();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuários"
        description="Somente Master altera papéis. Não há cadastro público."
        breadcrumbs={[{ label: "Usuários" }]}
      />

      {!result.success ? (
        <ErrorState message={result.error.message} />
      ) : result.data.length === 0 ? (
        <EmptyState title="Nenhum perfil encontrado." />
      ) : (
        <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--surface-2)] text-xs uppercase text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">E-mail</th>
                <th className="px-4 py-3">Papel</th>
                <th className="px-4 py-3">Ativo</th>
                <th className="px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {result.data.map((user) => (
                <tr key={user.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-3">{user.full_name}</td>
                  <td className="px-4 py-3">{user.email}</td>
                  <td className="px-4 py-3">{ROLE_LABELS[user.role]}</td>
                  <td className="px-4 py-3">{user.is_active ? "Sim" : "Não"}</td>
                  <td className="px-4 py-3">
                    <UserRoleForm userId={user.id} role={user.role} isActive={user.is_active} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
