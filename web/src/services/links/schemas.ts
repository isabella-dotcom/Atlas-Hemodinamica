import { z } from "zod";
import {
  confidenceSchema,
  emptyToNull,
  optionalNullableText,
} from "@/lib/validation";

const linkFields = {
  role_title: optionalNullableText,
  function_title: optionalNullableText,
  department: optionalNullableText,
  practiced_specialty: optionalNullableText,
  relationship_type: optionalNullableText,
  is_coordinator: z.boolean().default(false),
  is_team_leader: z.boolean().default(false),
  is_technical_responsible: z.boolean().default(false),
  is_clinical_staff: z.boolean().default(false),
  coordinator_justification: optionalNullableText,
  coordinator_confirmed: z.boolean().default(false),
  weekly_hours: z.preprocess(
    emptyToNull,
    z.coerce.number().min(0).max(168).nullable().optional(),
  ),
  is_sus_link: z.boolean().nullable().optional(),
  evidence_id: z.preprocess(
    emptyToNull,
    z.string().uuid().nullable().optional(),
  ),
  status: z
    .enum(["ativo", "encerrado", "provisorio", "desconhecido"])
    .default("desconhecido"),
  started_on: z.preprocess(emptyToNull, z.string().nullable().optional()),
  ended_on: z.preprocess(emptyToNull, z.string().nullable().optional()),
  source_id: z.preprocess(
    emptyToNull,
    z.string().uuid().nullable().optional(),
  ),
  confidence_score: confidenceSchema.default(30),
  notes: optionalNullableText,
  layer: z.enum(["bruto", "candidato", "oficial"]).default("candidato"),
  last_verified_at: z.preprocess(emptyToNull, z.string().nullable().optional()),
};

function refineLinkDates<T extends { started_on?: string | null; ended_on?: string | null }>(
  data: T,
  ctx: z.RefinementCtx,
) {
  if (data.ended_on && data.started_on && data.ended_on < data.started_on) {
    ctx.addIssue({
      code: "custom",
      message: "A data final não pode ser anterior à data inicial.",
      path: ["ended_on"],
    });
  }
}

function refineCoordinator<
  T extends {
    is_coordinator?: boolean;
    coordinator_confirmed?: boolean;
    coordinator_justification?: string | null;
    source_id?: string | null;
  },
>(data: T, ctx: z.RefinementCtx) {
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
}

export const linkSchema = z
  .object({
    doctor_id: z.string().uuid(),
    facility_id: z.string().uuid(),
    ...linkFields,
  })
  .superRefine((data, ctx) => {
    refineLinkDates(data, ctx);
    refineCoordinator(data, ctx);
  });

export const linkUpdateSchema = z
  .object(linkFields)
  .partial()
  .superRefine((data, ctx) => {
    refineLinkDates(data, ctx);
    refineCoordinator(data, ctx);
  });

export type LinkInput = z.infer<typeof linkSchema>;
export type LinkUpdateInput = z.infer<typeof linkUpdateSchema>;
