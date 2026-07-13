import { test as base, expect } from "@playwright/test";

function assertSafeE2EEnvironment() {
  const allow = process.env.E2E_ALLOW_DESTRUCTIVE_TESTS === "true";
  const baseUrl = process.env.E2E_BASE_URL || "";
  const projectRef = process.env.E2E_SUPABASE_PROJECT_REF || "";

  if (!allow) {
    throw new Error(
      "E2E bloqueado: defina E2E_ALLOW_DESTRUCTIVE_TESTS=true apenas em ambiente de teste.",
    );
  }

  let hostname = "";
  try {
    hostname = new URL(baseUrl).hostname;
  } catch {
    throw new Error("E2E_BASE_URL inválida.");
  }

  const blocked = ["vercel.app", "supabase.co"].some(
    (part) => hostname.includes(part) && !hostname.includes("localhost"),
  );
  if (hostname !== "127.0.0.1" && hostname !== "localhost" && blocked) {
    throw new Error(
      `E2E recusado para hostname potencialmente de produção: ${hostname}`,
    );
  }

  if (!projectRef) {
    throw new Error(
      "E2E_SUPABASE_PROJECT_REF é obrigatório para identificar o projeto de teste.",
    );
  }

  return { baseUrl, projectRef };
}

export const test = base.extend<{
  e2eSafe: { baseUrl: string; projectRef: string };
}>({
  e2eSafe: async (_args, provide) => {
    const env = assertSafeE2EEnvironment();
    await provide(env);
  },
});

export { expect };
