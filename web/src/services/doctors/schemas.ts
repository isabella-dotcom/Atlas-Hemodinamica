import { z } from "zod";
import {
  birthDateSchema,
  confidenceSchema,
  emptyToNull,
  graduationYearSchema,
  optionalNullableText,
  optionalOrcidSchema,
  optionalText,
  optionalUrlSchema,
  optionalUfSchema,
  ufSchema,
} from "@/lib/validation";

const doctorClassification = z.enum([
  "possivel_candidato",
  "atuacao_provavel",
  "atuacao_institucional_confirmada",
  "especialista_confirmado",
  "rejeitado",
  "inativo",
  "falecido",
  "registro_duplicado",
]);

const validationStatus = z.enum([
  "nao_iniciada",
  "em_revisao",
  "parcialmente_validada",
  "validada",
  "rejeitada",
  "aguardando_informacao",
]);

const stringArrayFromInput = z.preprocess((value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/[,\n;]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (value == null || value === "") return [];
  return value;
}, z.array(z.string()));

/** Campos de perfil compartilhado entre create e update. */
export const doctorProfileFieldsSchema = z.object({
  full_name: z.string().trim().min(3, "Informe o nome completo"),
  social_name: optionalNullableText,
  sex: z.preprocess(
    emptyToNull,
    z.enum(["F", "M", "X", "NI"]).nullable().optional(),
  ),
  birth_date: birthDateSchema(),
  nationality: optionalNullableText,
  photo_path: optionalNullableText,
  biography: optionalNullableText,
  city: z.string().trim().min(2, "Informe a cidade"),
  state_uf: ufSchema,
  classification: doctorClassification.default("possivel_candidato"),
  validation_status: validationStatus.default("nao_iniciada"),
  confidence_score: confidenceSchema.default(10),
  notes: optionalNullableText,
  declared_practice_area: optionalNullableText,
  confirmed_practice_area: optionalNullableText,
  practice_keywords: stringArrayFromInput.default([]),
  graduation_institution: optionalNullableText,
  graduation_year: graduationYearSchema(true),
  residency: optionalNullableText,
  specialization: optionalNullableText,
  fellowships: stringArrayFromInput.default([]),
  masters_degree: optionalNullableText,
  doctorate_degree: optionalNullableText,
  professional_titles: stringArrayFromInput.default([]),
  medical_societies: stringArrayFromInput.default([]),
  is_sbhci_member: z.boolean().nullable().optional(),
  lattes_url: optionalUrlSchema,
  orcid: optionalOrcidSchema,
  scientific_identifiers: z
    .record(z.string(), z.unknown())
    .optional()
    .default({}),
});

export const doctorCreateSchema = doctorProfileFieldsSchema.extend({
  crm_number: optionalText,
  crm_uf: optionalUfSchema,
  crm_status: z
    .enum(["ativo", "inativo", "suspenso", "cancelado", "desconhecido"])
    .optional(),
  rqe_number: optionalText,
  rqe_uf: optionalUfSchema,
  specialty_id: z.preprocess(
    emptyToNull,
    z.string().uuid().nullable().optional(),
  ),
  facility_id: z.preprocess(
    emptyToNull,
    z.string().uuid().nullable().optional(),
  ),
  role_title: optionalNullableText,
  department: optionalNullableText,
});

export const doctorUpdateSchema = doctorProfileFieldsSchema.partial();

export const registrationSchema = z.object({
  doctor_id: z.string().uuid(),
  registration_type: z.enum(["CRM", "RQE"]),
  number: z.string().trim().min(1, "Informe o número"),
  state_uf: ufSchema,
  status: z
    .enum(["ativo", "inativo", "suspenso", "cancelado", "desconhecido"])
    .default("desconhecido"),
  specialty_id: z.preprocess(
    emptyToNull,
    z.string().uuid().nullable().optional(),
  ),
  source_id: z.preprocess(
    emptyToNull,
    z.string().uuid().nullable().optional(),
  ),
  is_primary: z.boolean().default(false),
  confidence_score: confidenceSchema.default(20),
  notes: optionalNullableText,
  inscription_type: optionalNullableText,
  consulted_at: z.preprocess(emptyToNull, z.string().nullable().optional()),
  verified_at: z.preprocess(emptyToNull, z.string().nullable().optional()),
  verification_status: z
    .enum([
      "nao_verificado",
      "em_verificacao",
      "verificado",
      "divergente",
      "invalido",
    ])
    .default("nao_verificado"),
  registration_details: optionalNullableText,
  rqe_area: optionalNullableText,
  rqe_status: optionalNullableText,
});

export const registrationUpdateSchema = registrationSchema
  .omit({ doctor_id: true, registration_type: true })
  .partial()
  .extend({
    number: z.string().trim().min(1, "Informe o número").optional(),
    state_uf: ufSchema.optional(),
  });

export const doctorSpecialtySchema = z.object({
  doctor_id: z.string().uuid(),
  specialty_id: z.string().uuid("Selecione a especialidade"),
  source_id: z.preprocess(
    emptyToNull,
    z.string().uuid().nullable().optional(),
  ),
  is_confirmed: z.boolean().default(false),
  is_primary: z.boolean().default(false),
  confidence_score: confidenceSchema.default(20),
});

export type DoctorCreateInput = z.infer<typeof doctorCreateSchema>;
export type DoctorUpdateInput = z.infer<typeof doctorUpdateSchema>;
export type RegistrationInput = z.infer<typeof registrationSchema>;
export type RegistrationUpdateInput = z.infer<typeof registrationUpdateSchema>;
export type DoctorSpecialtyInput = z.infer<typeof doctorSpecialtySchema>;
