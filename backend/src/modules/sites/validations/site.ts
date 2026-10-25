import { z } from "zod";

export const schemaIdSite = z.object({
  id: z.uuid("Identifiant de site invalide."),
});

export const schemaCreationSite = z.strictObject({
  nom: z.string().trim().min(1, "Le nom du site est obligatoire.").max(120),
  adresse: z.string().trim().max(200).optional(),
  ville: z.string().trim().max(100).optional(),
  telephone: z.string().trim().max(30).optional(),
});

export const schemaModificationSite = z
  .strictObject({
    nom: z.string().trim().min(1, "Le nom du site est obligatoire.").max(120).optional(),
    adresse: z.string().trim().max(200).nullable().optional(),
    ville: z.string().trim().max(100).nullable().optional(),
    telephone: z.string().trim().max(30).nullable().optional(),
  })
  .refine((donnees) => Object.keys(donnees).length > 0, {
    message: "Aucune modification envoyee.",
  });

export type DonneesCreationSite = z.infer<typeof schemaCreationSite>;
export type DonneesModificationSite = z.infer<typeof schemaModificationSite>;