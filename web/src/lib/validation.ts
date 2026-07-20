import { z } from "zod";

/** Converte string vazia / só espaços em null. */
export function emptyToNull(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export const optionalText = z.preprocess(
  emptyToNull,
  z.string().trim().min(1).nullable().optional(),
);

export const optionalNullableText = z.preprocess(
  emptyToNull,
  z.string().nullable().optional(),
);

export const ufSchema = z.preprocess(
  emptyToNull,
  z
    .string()
    .trim()
    .length(2, "UF deve ter 2 letras")
    .regex(/^[A-Za-z]{2}$/, "UF inválida")
    .transform((v) => v.toUpperCase()),
);

export const optionalUfSchema = z.preprocess(
  emptyToNull,
  z
    .string()
    .trim()
    .length(2, "UF deve ter 2 letras")
    .regex(/^[A-Za-z]{2}$/, "UF inválida")
    .transform((v) => v.toUpperCase())
    .nullable()
    .optional(),
);

export const confidenceSchema = z.coerce
  .number()
  .int("Confiança deve ser inteira")
  .min(0, "Confiança mínima é 0")
  .max(100, "Confiança máxima é 100");

export const optionalUrlSchema = z.preprocess(
  emptyToNull,
  z
    .string()
    .url("URL inválida. Use http:// ou https://")
    .nullable()
    .optional(),
);

export const optionalEmailSchema = z.preprocess(
  emptyToNull,
  z.string().email("E-mail inválido").nullable().optional(),
);

/** ORCID: 0000-0000-0000-0000 (último dígito pode ser X) */
export const optionalOrcidSchema = z.preprocess(
  emptyToNull,
  z
    .string()
    .regex(
      /^[0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{3}[0-9Xx]$/,
      "ORCID inválido. Formato: 0000-0000-0000-0000",
    )
    .nullable()
    .optional(),
);

export const optionalLatitudeSchema = z.preprocess(
  emptyToNull,
  z.coerce
    .number()
    .min(-90, "Latitude deve estar entre -90 e 90")
    .max(90, "Latitude deve estar entre -90 e 90")
    .nullable()
    .optional(),
);

export const optionalLongitudeSchema = z.preprocess(
  emptyToNull,
  z.coerce
    .number()
    .min(-180, "Longitude deve estar entre -180 e 180")
    .max(180, "Longitude deve estar entre -180 e 180")
    .nullable()
    .optional(),
);

export function graduationYearSchema(optional = true) {
  const currentYear = new Date().getFullYear();
  const base = z.coerce
    .number()
    .int("Ano inválido")
    .min(1950, "Ano de graduação inválido")
    .max(currentYear, "Ano de graduação não pode ser futuro");
  if (optional) {
    return z.preprocess(emptyToNull, base.nullable().optional());
  }
  return base;
}

export function birthDateSchema() {
  return z.preprocess(emptyToNull, z.string().nullable().optional()).superRefine(
    (value, ctx) => {
      if (!value) return;
      const date = new Date(`${value}T00:00:00`);
      if (Number.isNaN(date.getTime())) {
        ctx.addIssue({ code: "custom", message: "Data de nascimento inválida" });
        return;
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (date > today) {
        ctx.addIssue({
          code: "custom",
          message: "Data de nascimento não pode ser futura",
        });
      }
    },
  );
}

export const BRAZIL_UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

export type BrazilUf = (typeof BRAZIL_UFS)[number];
