import { describe, expect, it } from "vitest";
import { validatePublicEnv } from "@/lib/env";

describe("validatePublicEnv", () => {
  it("falha quando variáveis estão ausentes", () => {
    const result = validatePublicEnv({});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.length).toBeGreaterThan(0);
    }
  });

  it("aceita URL e anon key válidas sem ecoar valores", () => {
    const result = validatePublicEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "x".repeat(40),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(JSON.stringify(result)).not.toContain("service_role");
    }
  });

  it("rejeita URL inválida", () => {
    const result = validatePublicEnv({
      NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "x".repeat(40),
    });
    expect(result.ok).toBe(false);
  });
});
