"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/types/database";

const items = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/medicos", label: "Médicos" },
  { href: "/estabelecimentos", label: "Estabelecimentos" },
  { href: "/validacao", label: "Fila de validação", roles: ["master", "analista"] as AppRole[] },
  { href: "/importacoes", label: "Importações", roles: ["master", "analista"] as AppRole[] },
  { href: "/fontes", label: "Fontes" },
  {
    href: "/configuracoes/diagnostico",
    label: "Diagnóstico",
    roles: ["master"] as AppRole[],
  },
] as const;

export function AppSidebar({ role }: { role: AppRole | null }) {
  const pathname = usePathname();

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)]">
      <div className="border-b border-[var(--border)] px-5 py-6">
        <p className="font-[family-name:var(--font-display)] text-lg tracking-tight text-[var(--ink)]">
          Atlas
        </p>
        <p className="mt-0.5 text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
          Hemodinâmica
        </p>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {items.map((item) => {
          const allowedRoles = "roles" in item ? item.roles : null;
          if (
            allowedRoles &&
            (!role || !(allowedRoles as readonly AppRole[]).includes(role))
          ) {
            return null;
          }

          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-[var(--accent-soft)] font-medium text-[var(--accent)]"
                  : "text-[var(--ink-soft)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-[var(--border)] p-4 text-xs text-[var(--muted)]">
        MVP · Minas Gerais
      </div>
    </aside>
  );
}
