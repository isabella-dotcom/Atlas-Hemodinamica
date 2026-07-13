"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { UsersProfile } from "@/types/database";
import { ROLE_LABELS } from "@/types/database";

export function AppHeader({ profile }: { profile: UsersProfile | null }) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)]/80 px-6 backdrop-blur">
      <div>
        <h1 className="text-sm font-medium text-[var(--ink)]">
          Base nacional de hemodinâmica
        </h1>
      </div>
      <div className="flex items-center gap-4">
        {profile && (
          <div className="text-right">
            <p className="text-sm text-[var(--ink)]">{profile.full_name}</p>
            <p className="text-xs text-[var(--muted)]">
              {ROLE_LABELS[profile.role]}
            </p>
          </div>
        )}
        <button
          type="button"
          onClick={handleSignOut}
          className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--ink-soft)] transition hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
        >
          Sair
        </button>
      </div>
    </header>
  );
}
