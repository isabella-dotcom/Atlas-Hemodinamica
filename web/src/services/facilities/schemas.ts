import { z } from "zod";

const uf = z
  .string()
  .trim()
  .length(2)
  .transform((v) => v.toUpperCase());

export const facilityCreateSchema = z.object({
  name: z.string().trim().min(3, "Informe o nome"),
  trade_name: z.string().optional(),
  cnes: z.string().optional(),
  cnpj: z.string().optional(),
  facility_type: z.string().optional(),
  city: z.string().trim().min(2),
  state_uf: uf,
  address_street: z.string().optional(),
  address_number: z.string().optional(),
  address_district: z.string().optional(),
  address_zip: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  website: z.string().url().optional().or(z.literal("")),
  attends_sus: z.enum(["unknown", "yes", "no"]).default("unknown"),
  has_hemodynamics: z.boolean().default(true),
  service_status: z.string().optional(),
  last_validated_at: z.string().optional().or(z.literal("")),
  source_id: z.string().uuid().optional().or(z.literal("")),
  notes: z.string().optional(),
  confidence_score: z.coerce.number().int().min(0).max(100).default(20),
});

export const facilityUpdateSchema = facilityCreateSchema.partial();

export type FacilityCreateInput = z.infer<typeof facilityCreateSchema>;
export type FacilityUpdateInput = z.infer<typeof facilityUpdateSchema>;
