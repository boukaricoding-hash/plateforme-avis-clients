import { z } from "zod";

// Duree de l'accord de support : 1 heure, 24 heures ou 7 jours (7 jours au maximum).
// Les durees sont en millisecondes ; le service calcule expire_le = maintenant + duree.
export const DUREES_ACCES_SUPPORT = {
  UNE_HEURE: 60 * 60 * 1000,
  VINGT_QUATRE_HEURES: 24 * 60 * 60 * 1000,
  SEPT_JOURS: 7 * 24 * 60 * 60 * 1000,
} as const;

export type DureeAccesSupport = keyof typeof DUREES_ACCES_SUPPORT;

// POST /api/v1/organisation/acces-support   corps : { "duree": "UNE_HEURE" }
// L'organisation vient toujours de la session, et tout autre champ envoye est refuse (strictObject).
export const schemaAccordSupport = z.strictObject({
  duree: z.enum(["UNE_HEURE", "VINGT_QUATRE_HEURES", "SEPT_JOURS"], {
    error: "La durée doit être UNE_HEURE, VINGT_QUATRE_HEURES ou SEPT_JOURS.",
  }),
});

export type DonneesAccordSupport = z.infer<typeof schemaAccordSupport>;