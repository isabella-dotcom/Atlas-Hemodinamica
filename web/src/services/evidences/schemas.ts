import { z } from "zod";

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
  source_id: z.string().uuid().optional().nullable(),
  title: z.string().trim().min(3),
  description: z.string().optional().nullable(),
  url: z.string().url().optional().or(z.literal("")).nullable(),
  collected_at: z.string().optional().nullable(),
  confirmed_field: z.string().optional().nullable(),
  captured_value: z.string().optional().nullable(),
  reliability_score: z.coerce.number().int().min(0).max(100).optional().nullable(),
  status: z
    .enum(["pendente", "aceita", "rejeitada", "expirada", "necessita_revisao"])
    .default("pendente"),
});

export type EvidenceInput = z.infer<typeof evidenceSchema>;
