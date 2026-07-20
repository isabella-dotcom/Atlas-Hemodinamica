import { z } from "zod";
import {
  confidenceSchema,
  emptyToNull,
  optionalNullableText,
} from "@/lib/validation";
import { normalizePhoneDigits } from "@/lib/format";

const contactChannels = z.enum([
  "email",
  "telefone",
  "celular",
  "whatsapp",
  "site",
  "secretaria",
  "formulario",
  "linkedin",
  "outro",
]);

const contactStatuses = z.enum([
  "nao_validado",
  "valido",
  "invalido",
  "desatualizado",
]);

function normalizeContactValue(channel: string, value: string): string {
  if (["telefone", "celular", "whatsapp"].includes(channel)) {
    return normalizePhoneDigits(value);
  }
  return value.trim();
}

function refineContactValue(
  channel: string,
  value: string,
  ctx: z.RefinementCtx,
) {
  if (channel === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    ctx.addIssue({
      code: "custom",
      message: "E-mail inválido.",
      path: ["value"],
    });
  }
  if (
    (channel === "site" || channel === "linkedin" || channel === "formulario") &&
    value &&
    !/^https?:\/\//i.test(value)
  ) {
    ctx.addIssue({
      code: "custom",
      message: "URL inválida. Use http:// ou https://",
      path: ["value"],
    });
  }
  if (["telefone", "celular", "whatsapp"].includes(channel)) {
    const digits = normalizePhoneDigits(value);
    if (digits.length < 10 || digits.length > 13) {
      ctx.addIssue({
        code: "custom",
        message: "Telefone inválido. Informe DDD + número.",
        path: ["value"],
      });
    }
  }
}

export const contactSchema = z
  .object({
    doctor_id: z.string().uuid().optional().nullable(),
    facility_id: z.string().uuid().optional().nullable(),
    channel: contactChannels,
    value: z.string().trim().min(3, "Informe o contato"),
    label: optionalNullableText,
    is_institutional: z.boolean().default(true),
    is_publicly_available: z.boolean().default(true),
    is_primary: z.boolean().default(false),
    do_not_contact: z.boolean().default(false),
    contact_status: contactStatuses.default("nao_validado"),
    accepts_contact: z.boolean().nullable().optional(),
    source_origin: optionalNullableText,
    collected_at: z.preprocess(emptyToNull, z.string().nullable().optional()),
    last_attempt_at: z.preprocess(emptyToNull, z.string().nullable().optional()),
    last_attempt_result: optionalNullableText,
    source_id: z.preprocess(
      emptyToNull,
      z.string().uuid().nullable().optional(),
    ),
    confidence_score: confidenceSchema.default(40),
  })
  .superRefine((data, ctx) => {
    if (!data.doctor_id && !data.facility_id) {
      ctx.addIssue({
        code: "custom",
        message: "Informe médico ou estabelecimento.",
        path: ["doctor_id"],
      });
    }
    refineContactValue(data.channel, data.value, ctx);
  })
  .transform((data) => ({
    ...data,
    value: normalizeContactValue(data.channel, data.value),
  }));

export const contactUpdateSchema = z
  .object({
    channel: contactChannels.optional(),
    value: z.string().trim().min(3, "Informe o contato").optional(),
    label: optionalNullableText,
    is_institutional: z.boolean().optional(),
    is_publicly_available: z.boolean().optional(),
    is_primary: z.boolean().optional(),
    do_not_contact: z.boolean().optional(),
    contact_status: contactStatuses.optional(),
    accepts_contact: z.boolean().nullable().optional(),
    source_origin: optionalNullableText,
    collected_at: z.preprocess(emptyToNull, z.string().nullable().optional()),
    last_attempt_at: z.preprocess(emptyToNull, z.string().nullable().optional()),
    last_attempt_result: optionalNullableText,
    source_id: z.preprocess(
      emptyToNull,
      z.string().uuid().nullable().optional(),
    ),
    confidence_score: confidenceSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.channel && data.value) {
      refineContactValue(data.channel, data.value, ctx);
    }
  })
  .transform((data) => {
    if (data.channel && data.value) {
      return {
        ...data,
        value: normalizeContactValue(data.channel, data.value),
      };
    }
    return data;
  });

export type ContactInput = z.infer<typeof contactSchema>;
export type ContactUpdateInput = z.infer<typeof contactUpdateSchema>;
