import { z } from "zod";
import {
  confidenceSchema,
  emptyToNull,
  optionalNullableText,
  optionalUrlSchema,
} from "@/lib/validation";

export const evidenceSchema = z.object({
  entity_type: z.enum([
    "doctor",
    "facility",
    "link",
    "contact",
    "registration",
    "specialty",
  ]),
  entity_id: z.string().uuid(),
  source_id: z.preprocess(
    emptyToNull,
    z.string().uuid().nullable().optional(),
  ),
  title: z.string().trim().min(3, "Informe o título"),
  description: optionalNullableText,
  url: optionalUrlSchema,
  collected_at: z.preprocess(emptyToNull, z.string().nullable().optional()),
  confirmed_field: optionalNullableText,
  captured_value: optionalNullableText,
  reliability_score: confidenceSchema.nullable().optional(),
  status: z
    .enum(["pendente", "aceita", "rejeitada", "expirada", "necessita_revisao"])
    .default("pendente"),
  storage_path: optionalNullableText,
});

export type EvidenceInput = z.infer<typeof evidenceSchema>;
