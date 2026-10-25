import { z } from "zod";

export const schemaConnexion = z.object({
  email: z.string().trim().toLowerCase().min(1, "L'adresse e-mail est obligatoire.").max(254),
  mot_de_passe: z.string().min(1, "Le mot de passe est obligatoire.").max(200),
  se_souvenir: z.boolean().default(false),
});

export type DonneesConnexion = z.infer<typeof schemaConnexion>;