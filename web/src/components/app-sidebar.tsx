"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/types/database";
import { canAccessRawData, canManageUsers, canViewAudit, canWrite, isMaster } from "@/lib/permissions";

type NavItem = {
  href: string;
  label: string;
  visible: (role: AppRole | null) => boolean;
};

const items: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", visible: () => true },
  { href: "/medicos", label: "Buscar médicos", visible: () => true },
  { href: "/estabelecimentos", label: "Estabelecimentos", visible: () => true },
  {
    href: "/validacao",
    label: "Fila de validação",
    visible: (role) => canWrite(role),
  },
  {
    href: "/importacoes",
    label: "Importações",
    visible: (role) => canAccessRawData(role),
  },
  { href: "/fontes", label: "Fontes", visible: () => true },
  {
    href: "/auditoria",
    label: "Auditoria",
    visible: (role) => canViewAudit(role),
  },
  {
    href: "/usuarios",
    label: "Usuários",
    visible: (role) => canManageUsers(role),
  },
  {
    href: "/configuracoes/diagnostico",
    label: "Configurações",
    visible: (role) => isMaster(role),
  },
];

export function AppSidebar({ role }: { role: AppRole | null }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const env = process.env.NODE_ENV === "production" ? "production" : "development";

  const nav = (
    <>
      <div className="border-b border-[var(--border)] px-5 py-6">
        <p className="font-[family-name:var(--font-display)] text-lg tracking-tight text-[var(--ink)]">
          {collapsed ? "AH" : "Atlas"}
        </p>
        {!collapsed ? (
          <p className="mt-0.5 text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
            Hemodinâmica
          </p>
        ) : null}
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {items
          .filter((item) => item.visible(role))
          .map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-[var(--accent-soft)] font-medium text-[var(--accent)]"
                    : "text-[var(--ink-soft)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]",
                )}
              >
                {collapsed ? item.label.slice(0, 1) : item.label}
              </Link>
            );
          })}
      </nav>
      <div className="space-y-2 border-t border-[var(--border)] p-4 text-xs text-[var(--muted)]">
        <p>MVP · MG · {env}</p>
        <button
          type="button"
          className="text-[var(--accent)] hover:underline"
          onClick={() => setCollapsed((v) => !v)}
        >
          {collapsed ? "Expandir" : "Recolher"}
        </button>
      </div>
    </>
  );

  return (
    <>
      <button
        type="button"
        className="fixed left-4 top-4 z-40 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm lg:hidden"
        aria-label="Abrir menu"
        onClick={() => setMobileOpen(true)}
      >
        Menu
      </button>
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setMobileOpen(false)} />
      ) : null}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-[var(--border)] bg-[var(--surface)] transition lg:static lg:translate-x-0",
          collapsed && "lg:w-20",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        {nav}
      </aside>
    </>
  );
}
