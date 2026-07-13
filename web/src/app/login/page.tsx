import { LoginForm } from "@/components/login-form";
import { hasValidPublicEnv } from "@/lib/env";

type SearchParams = Promise<{ error?: string }>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const configured = hasValidPublicEnv();

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-teal-200/40 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-slate-300/40 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)]/95 p-8 shadow-sm backdrop-blur">
        <div className="mb-8">
          <p className="font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">
            Atlas da Hemodinâmica
          </p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Acesso interno para construção e validação da base nacional.
          </p>
        </div>

        {!configured ? (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950">
            Supabase não configurado. Crie <code>web/.env.local</code> a partir
            de <code>web/.env.example</code> com{" "}
            <code>NEXT_PUBLIC_SUPABASE_URL</code> e{" "}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>. Valores das chaves nunca
            são exibidos.
          </div>
        ) : null}

        {params.error === "inactive" ? (
          <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            Conta inativa ou sem perfil. Contate um administrador Master.
          </div>
        ) : null}

        <LoginForm disabled={!configured} />
      </div>
    </main>
  );
}
