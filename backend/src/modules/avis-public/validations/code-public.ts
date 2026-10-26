import { z } from "zod";

// Le code public du QR code : lettres, chiffres, "-" et "_", 10 caracteres ou plus.
export const schemaCodePublic = z.object({
  code: z
    .string()
    .min(10)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/),
});