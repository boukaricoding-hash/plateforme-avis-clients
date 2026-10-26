import { z } from "zod";

export const schemaIdNotification = z.object({
  id: z.uuid("Identifiant de notification invalide."),
});

// Dans l'adresse, un booléen s'écrit ?non_lues=true ou ?non_lues=false.
const booleen = z
  .enum(["true", "false"], { error: "La valeur doit être true ou false." })
  .transform((valeur) => valeur === "true");

// GET /api/v1/notifications?non_lues=true&page=1&limite=20
export const schemaFiltresNotifications = z.object({
  non_lues: booleen.optional(),
  page: z.coerce.number({ error: "La page doit être un nombre." }).int().min(1).default(1),
  limite: z.coerce
    .number({ error: "La limite doit être un nombre." })
    .int()
    .min(1, "La limite minimale est 1.")
    .max(100, "La limite maximale est 100.")
    .default(20),
});

export type FiltresNotifications = z.infer<typeof schemaFiltresNotifications>;