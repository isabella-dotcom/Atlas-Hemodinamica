export type AppConfigState =
  | { status: "configured" }
  | { status: "unconfigured"; message: string }
  | { status: "error"; message: string; code?: string };

export function unconfiguredResult(message =
  "Supabase não configurado. Preencha web/.env.local com NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
): AppConfigState {
  return { status: "unconfigured", message };
}

export function configError(
  message: string,
  code?: string,
): AppConfigState {
  return { status: "error", message, code };
}
