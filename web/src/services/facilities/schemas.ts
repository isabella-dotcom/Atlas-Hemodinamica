import { z } from "zod";
import {
  confidenceSchema,
  emptyToNull,
  optionalEmailSchema,
  optionalLatitudeSchema,
  optionalLongitudeSchema,
  optionalNullableText,
  optionalUrlSchema,
  ufSchema,
} from "@/lib/validation";
import { normalizePhoneDigits } from "@/lib/format";

const triState = z.enum(["unknown", "yes", "no"]).default("unknown");

const optionalPhone = z.preprocess((value) => {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return value;
  const digits = normalizePhoneDigits(value);
  return digits === "" ? null : digits;
}, z.string().nullable().optional());

/** Campos compartilhados create/update de estabelecimento. */
export const facilityFieldsSchema = z.object({
  name: z.string().trim().min(3, "Informe o nome"),
  trade_name: optionalNullableText,
  cnes: optionalNullableText,
  cnpj: optionalNullableText,
  facility_type: optionalNullableText,
  legal_nature: optionalNullableText,
  ownership_type: z.preprocess(
    emptyToNull,
    z.enum(["publico", "privado", "filantropico", "misto"]).nullable().optional(),
  ),
  branch_type: z.preprocess(
    emptyToNull,
    z.enum(["matriz", "filial", "unico"]).nullable().optional(),
  ),
  is_active: z.boolean().default(true),
  city: z.string().trim().min(2, "Informe o município"),
  state_uf: ufSchema,
  address_street: optionalNullableText,
  address_number: optionalNullableText,
  address_complement: optionalNullableText,
  address_district: optionalNullableText,
  address_zip: optionalNullableText,
  ibge_city_code: optionalNullableText,
  region: optionalNullableText,
  latitude: optionalLatitudeSchema,
  longitude: optionalLongitudeSchema,
  phone: optionalPhone,
  email: optionalEmailSchema,
  website: optionalUrlSchema,
  hemodynamics_phone: optionalPhone,
  institutional_whatsapp: optionalPhone,
  hemodynamics_email: optionalEmailSchema,
  secretary_contact: optionalNullableText,
  service_manager_contact: optionalNullableText,
  attends_sus: triState,
  attends_private: triState,
  attends_insurance: triState,
  has_hemodynamics: z.boolean().default(true),
  has_catheterization_lab: z.boolean().nullable().optional(),
  has_interventional_cardiology: z.boolean().nullable().optional(),
  has_interventional_radiology: z.boolean().nullable().optional(),
  has_interventional_neuroradiology: z.boolean().nullable().optional(),
  is_24_hours: z.boolean().nullable().optional(),
  has_emergency_service: z.boolean().nullable().optional(),
  estimated_rooms: z.preprocess(
    emptyToNull,
    z.coerce.number().int().min(0).nullable().optional(),
  ),
  estimated_equipment: z.preprocess(
    emptyToNull,
    z.coerce.number().int().min(0).nullable().optional(),
  ),
  procedures: optionalNullableText,
  service_notes: optionalNullableText,
  last_service_confirmed_at: z.preprocess(
    emptyToNull,
    z.string().nullable().optional(),
  ),
  service_status: optionalNullableText,
  last_validated_at: z.preprocess(emptyToNull, z.string().nullable().optional()),
  source_id: z.preprocess(
    emptyToNull,
    z.string().uuid().nullable().optional(),
  ),
  notes: optionalNullableText,
  confidence_score: confidenceSchema.default(20),
});

export const facilityCreateSchema = facilityFieldsSchema;
export const facilityUpdateSchema = facilityFieldsSchema.partial();

export type FacilityCreateInput = z.infer<typeof facilityCreateSchema>;
export type FacilityUpdateInput = z.infer<typeof facilityUpdateSchema>;

export function triStateToBool(
  value: "unknown" | "yes" | "no" | undefined,
): boolean | null {
  if (value === "yes") return true;
  if (value === "no") return false;
  return null;
}

export function boolToTriState(
  value: boolean | null | undefined,
): "unknown" | "yes" | "no" {
  if (value === true) return "yes";
  if (value === false) return "no";
  return "unknown";
}
