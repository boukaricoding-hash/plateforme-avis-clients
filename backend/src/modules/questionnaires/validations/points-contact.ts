import { z } from "zod";

// PUT : on envoie la liste complete des points de contact du questionnaire.
export const schemaAssociationPointsContact = z.strictObject({
  points_contact_ids: z
    .array(z.uuid("Identifiant de point de contact invalide."))
    .max(500, "Vous pouvez associer au maximum 500 points de contact a la fois.")
    .refine((ids) => new Set(ids).size === ids.length, {
      message: "Un point de contact est present plusieurs fois.",
    }),
});

export type DonneesAssociation = z.infer<typeof schemaAssociationPointsContact>;