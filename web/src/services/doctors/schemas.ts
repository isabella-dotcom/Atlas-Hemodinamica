import { z } from "zod";

const uf = z
  .string()
  .trim()
  .length(2, "UF com 2 letras")
  .transform((v) => v.toUpperCase());

export const doctorCreateSchema = z.object({
  full_name: z.string().trim().min(3, "Informe o nome completo"),
  city: z.string().trim().min(2, "Informe a cidade"),
  state_uf: uf,
  classification: z
    .enum([
      "possivel_candidato",
      "atuacao_provavel",
      "atuacao_institucional_confirmada",
      "especialista_confirmado",
      "rejeitado",
      "inativo",
    ])
    .default("possivel_candidato"),
  validation_status: z
    .enum([
      "nao_iniciada",
      "em_revisao",
      "parcialmente_validada",
      "validada",
      "rejeitada",
      "aguardando_informacao",
    ])
    .default("nao_iniciada"),
  confidence_score: z.coerce.number().int().min(0).max(100).default(10),
  notes: z.string().optional(),
  crm_number: z.string().optional(),
  crm_uf: z.string().optional(),
  crm_status: z
    .enum(["ativo", "inativo", "suspenso", "cancelado", "desconhecido"])
    .optional(),
  rqe_number: z.string().optional(),
  rqe_uf: z.string().optional(),
  specialty_id: z.string().uuid().optional().or(z.literal("")),
  facility_id: z.string().uuid().optional().or(z.literal("")),
  role_title: z.string().optional(),
  department: z.string().optional(),
});

export const doctorUpdateSchema = z.object({
  full_name: z.string().trim().min(3).optional(),
  city: z.string().trim().min(2).optional(),
  state_uf: uf.optional(),
  classification: z
    .enum([
      "possivel_candidato",
      "atuacao_provavel",
      "atuacao_institucional_confirmada",
      "especialista_confirmado",
      "rejeitado",
      "inativo",
    ])
    .optional(),
  validation_status: z
    .enum([
      "nao_iniciada",
      "em_revisao",
      "parcialmente_validada",
      "validada",
      "rejeitada",
      "aguardando_informacao",
    ])
    .optional(),
  confidence_score: z.coerce.number().int().min(0).max(100).optional(),
  notes: z.string().nullable().optional(),
});

export const registrationSchema = z.object({
  doctor_id: z.string().uuid(),
  registration_type: z.enum(["CRM", "RQE"]),
  number: z.string().trim().min(1, "Informe o número"),
  state_uf: uf,
  status: z
    .enum(["ativo", "inativo", "suspenso", "cancelado", "desconhecido"])
    .default("desconhecido"),
  specialty_id: z.string().uuid().optional().nullable(),
  source_id: z.string().uuid().optional().nullable(),
  is_primary: z.boolean().default(false),
  confidence_score: z.coerce.number().int().min(0).max(100).default(20),
  notes: z.string().optional().nullable(),
});

export const doctorSpecialtySchema = z.object({
  doctor_id: z.string().uuid(),
  specialty_id: z.string().uuid(),
  source_id: z.string().uuid().optional().nullable(),
  is_confirmed: z.boolean().default(false),
  is_primary: z.boolean().default(false),
  confidence_score: z.coerce.number().int().min(0).max(100).default(20),
});

export type DoctorCreateInput = z.infer<typeof doctorCreateSchema>;
export type DoctorUpdateInput = z.infer<typeof doctorUpdateSchema>;
export type RegistrationInput = z.infer<typeof registrationSchema>;
