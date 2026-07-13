import { z } from "zod";

export const linkSchema = z
  .object({
    doctor_id: z.string().uuid(),
    facility_id: z.string().uuid(),
    role_title: z.string().optional().nullable(),
    department: z.string().optional().nullable(),
    relationship_type: z.string().optional().nullable(),
    is_coordinator: z.boolean().default(false),
    is_technical_responsible: z.boolean().default(false),
    coordinator_justification: z.string().optional().nullable(),
    coordinator_confirmed: z.boolean().default(false),
    status: z
      .enum(["ativo", "encerrado", "provisorio", "desconhecido"])
      .default("desconhecido"),
    started_on: z.string().optional().nullable(),
    ended_on: z.string().optional().nullable(),
    source_id: z.string().uuid().optional().nullable(),
    confidence_score: z.coerce.number().int().min(0).max(100).default(30),
    notes: z.string().optional().nullable(),
    layer: z.enum(["bruto", "candidato", "oficial"]).default("candidato"),
  })
  .superRefine((data, ctx) => {
    if (
      data.ended_on &&
      data.started_on &&
      data.ended_on < data.started_on
    ) {
      ctx.addIssue({
        code: "custom",
        message: "A data final não pode ser anterior à data inicial.",
        path: ["ended_on"],
      });
    }
    if (
      data.is_coordinator &&
      data.coordinator_confirmed &&
      !data.coordinator_justification &&
      !data.source_id
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Coordenador confirmado exige justificativa ou fonte.",
        path: ["coordinator_justification"],
      });
    }
  });

export const linkUpdateSchema = z.object({
  role_title: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  relationship_type: z.string().optional().nullable(),
  is_coordinator: z.boolean().optional(),
  is_technical_responsible: z.boolean().optional(),
  coordinator_justification: z.string().optional().nullable(),
  coordinator_confirmed: z.boolean().optional(),
  status: z
    .enum(["ativo", "encerrado", "provisorio", "desconhecido"])
    .optional(),
  started_on: z.string().optional().nullable(),
  ended_on: z.string().optional().nullable(),
  source_id: z.string().uuid().optional().nullable(),
  confidence_score: z.coerce.number().int().min(0).max(100).optional(),
  notes: z.string().optional().nullable(),
  layer: z.enum(["bruto", "candidato", "oficial"]).optional(),
});

export type LinkInput = z.infer<typeof linkSchema>;
export type LinkUpdateInput = z.infer<typeof linkUpdateSchema>;
