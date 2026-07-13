import { NextResponse } from "next/server";
import { runFoundationDiagnostic } from "@/lib/diagnostics";
import { createClient, hasSupabaseEnv } from "@/lib/supabase/server";

export async function POST() {
  if (!hasSupabaseEnv()) {
    return NextResponse.json(
      { error: "Supabase não configurado" },
      { status: 503 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("users_profile")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.is_active === false || profile.role !== "master") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const report = await runFoundationDiagnostic();
  return NextResponse.json(report);
}
