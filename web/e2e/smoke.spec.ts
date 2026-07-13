import { test, expect } from "./fixtures";

const DEMO_PREFIX = "[E2E-ATLAS]";

test.describe("Atlas E2E (ambiente de teste)", () => {
  test("login page renders without leaking secrets", async ({ page, e2eSafe }) => {
    expect(e2eSafe.projectRef).toBeTruthy();
    await page.goto("/login");
    await expect(page.getByText("Atlas da Hemodinâmica")).toBeVisible();
    const content = await page.content();
    expect(content).not.toMatch(/service_role/i);
    expect(content).not.toMatch(/eyJ[a-zA-Z0-9_-]{20,}/);
  });

  test("rota protegida redireciona para login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/login/);
  });

  test("fluxo autenticado opcional", async ({ page }) => {
    const email = process.env.E2E_MASTER_EMAIL;
    const password = process.env.E2E_MASTER_PASSWORD;
    test.skip(!email || !password, "Credenciais E2E_MASTER_* não configuradas");

    await page.goto("/login");
    await page.getByLabel("E-mail").fill(email!);
    await page.getByLabel("Senha").fill(password!);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/dashboard/);

    await page.goto("/estabelecimentos/novo");
    await page.getByLabel(/Razão social|nome/i).first().fill(`${DEMO_PREFIX} Hospital Teste`);
    // Demais passos dependem dos labels exatos do formulário no ambiente conectado.
  });
});
