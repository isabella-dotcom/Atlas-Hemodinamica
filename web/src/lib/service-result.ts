export type ServiceResult<T> =
  | { success: true; data: T }
  | {
      success: false;
      error: {
        code?: string;
        message: string;
      };
    };

export function ok<T>(data: T): ServiceResult<T> {
  return { success: true, data };
}

export function fail<T = never>(
  message: string,
  code?: string,
): ServiceResult<T> {
  return { success: false, error: { message, code } };
}

const FRIENDLY: Record<string, string> = {
  "23505": "Já existe um registro com esses dados.",
  "23503": "Referência inválida. Verifique os vínculos informados.",
  "23514": "Os dados informados não atendem às regras de validação.",
  "42501": "Você não possui permissão para esta ação.",
  PGRST116: "Registro não encontrado.",
};

export function mapSupabaseError(
  error: { code?: string; message?: string } | null | undefined,
  fallback = "Não foi possível concluir a operação.",
): ServiceResult<never> {
  if (!error) return fail(fallback);

  const code = error.code;
  if (code && FRIENDLY[code]) {
    return fail(FRIENDLY[code], code);
  }

  const raw = (error.message ?? "").toLowerCase();
  if (raw.includes("duplicate") || raw.includes("unique")) {
    return fail("Já existe um registro com esses dados.", code);
  }
  if (raw.includes("permission") || raw.includes("policy") || raw.includes("rls")) {
    return fail("Você não possui permissão para esta ação.", code);
  }
  if (raw.includes("coordenador confirmado")) {
    return fail(
      "Coordenador confirmado exige justificativa ou fonte.",
      code,
    );
  }
  if (raw.includes("data final")) {
    return fail("A data final não pode ser anterior à data inicial.", code);
  }

  return fail(fallback, code);
}
