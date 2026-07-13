import { z } from "zod";

export const contactSchema = z
  .object({
    doctor_id: z.string().uuid().optional().nullable(),
    facility_id: z.string().uuid().optional().nullable(),
    channel: z.enum(["email", "telefone", "whatsapp", "site", "outro"]),
    value: z.string().trim().min(3, "Informe o contato"),
    label: z.string().optional().nullable(),
    is_institutional: z.boolean().default(true),
    is_publicly_available: z.boolean().default(true),
    is_primary: z.boolean().default(false),
    do_not_contact: z.boolean().default(false),
    source_id: z.string().uuid().optional().nullable(),
    confidence_score: z.coerce.number().int().min(0).max(100).default(40),
  })
  .superRefine((data, ctx) => {
    if (!data.doctor_id && !data.facility_id) {
      ctx.addIssue({
        code: "custom",
        message: "Informe médico ou estabelecimento.",
        path: ["doctor_id"],
      });
    }
    if (data.channel === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.value)) {
      ctx.addIssue({
        code: "custom",
        message: "E-mail inválido.",
        path: ["value"],
      });
    }
    if (
      data.channel === "site" &&
      !/^https?:\/\//i.test(data.value)
    ) {
      ctx.addIssue({
        code: "custom",
        message: "URL inválida. Use http:// ou https://",
        path: ["value"],
      });
    }
  });

export type ContactInput = z.infer<typeof contactSchema>;
