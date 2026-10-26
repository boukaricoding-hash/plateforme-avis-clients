import { z } from "zod";
import { STATUTS_TRAITEMENT } from "./avis";

// PATCH /api/v1/avis/:id/statut
// Le commentaire est facultatif : un champ vide est accepté (le service l'enregistre comme "pas de commentaire").
export const schemaChangementStatut = z.object({
  statut: z.enum(STATUTS_TRAITEMENT, { error: "Statut inconnu." }),
  commentaire: z
    .string({ error: "Le commentaire doit être un texte." })
    .trim()
    .max(2000, { error: "Le commentaire est trop long (2000 caractères maximum)." })
    .optional(),
});

// POST /api/v1/avis/:id/notes
// Une note interne n'a pas de sens sans texte : elle est obligatoire.
export const schemaNoteInterne = z.object({
  commentaire: z
    .string({ error: "La note doit être un texte." })
    .trim()
    .min(1, { error: "La note est vide." })
    .max(2000, { error: "La note est trop longue (2000 caractères maximum)." }),
});

export type DonneesChangementStatut = z.infer<typeof schemaChangementStatut>;
export type DonneesNoteInterne = z.infer<typeof schemaNoteInterne>;