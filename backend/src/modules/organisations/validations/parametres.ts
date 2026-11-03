import { z } from "zod";

// Couleur au format #RRGGBB (exemple : #1d4ed8).
const couleur = z
  .string({ error: "La couleur doit être un texte." })
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "La couleur doit être au format #RRGGBB, par exemple #1d4ed8.");

// PATCH /api/v1/organisation/parametres
// Seuls ces champs peuvent changer : l'organisation vient toujours de la session,
// et tout autre champ envoye est refuse (strictObject).
// - seuil_alerte_note : un avis alerte si sa note est inferieure ou egale (1 a 4 : 5 alerterait
//   sur tous les avis).
// - seuil_alerte_nps : un avis alerte si son NPS est inferieur ou egal (0 a 9 : 10 alerterait
//   sur tous les avis).
// - couleur_principale : null efface la couleur.
export const schemaModificationParametres = z
  .strictObject({
    couleur_principale: couleur.nullable().optional(),
    seuil_alerte_note: z
      .number({ error: "Le seuil de note doit être un nombre." })
      .int("Le seuil de note doit être un nombre entier.")
      .min(1, "Le seuil de note minimal est 1.")
      .max(4, "Le seuil de note maximal est 4.")
      .optional(),
    seuil_alerte_nps: z
      .number({ error: "Le seuil NPS doit être un nombre." })
      .int("Le seuil NPS doit être un nombre entier.")
      .min(0, "Le seuil NPS minimal est 0.")
      .max(9, "Le seuil NPS maximal est 9.")
      .optional(),
  })
  .refine((donnees) => Object.keys(donnees).length > 0, {
    message: "Aucune modification envoyée.",
  });

export type DonneesModificationParametres = z.infer<typeof schemaModificationParametres>;