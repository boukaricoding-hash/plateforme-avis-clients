import { z } from "zod";

// ------------------------------------------------------------
// Validations des routes QR codes (jour 8)
// ------------------------------------------------------------
// - GET  /points-contact/{id}/qr?format=png|svg|pdf&taille=A6|A5&largeur=1024
// - POST /points-contact/{id}/revoquer   { "regenerer": true }  (corps facultatif)
// La planche A4 et les statistiques n'ont besoin que de ?site_id= :
// elles reutilisent schemaFiltrePointsContact (validations/point-contact.ts).

export const schemaTelechargementQr = z.object({
  format: z
    .enum(["png", "svg", "pdf"], { error: "Le format doit être png, svg ou pdf." })
    .default("png"),
  // Taille du chevalet : utilisee seulement pour le PDF.
  taille: z.enum(["A6", "A5"], { error: "La taille doit être A6 ou A5." }).default("A6"),
  // Largeur du PNG en pixels : utilisee seulement pour le PNG.
  largeur: z.coerce
    .number({ error: "La largeur doit être un nombre." })
    .int({ error: "La largeur doit être un nombre entier." })
    .min(256, { error: "La largeur minimale est de 256 pixels." })
    .max(2048, { error: "La largeur maximale est de 2048 pixels." })
    .optional(),
});

// Sans corps, le controleur envoie {} : on revoque simplement (regenerer = false).
export const schemaRevocationQr = z.strictObject({
  regenerer: z.boolean({ error: "regenerer doit être vrai ou faux." }).default(false),
});

export type DonneesTelechargementQr = z.infer<typeof schemaTelechargementQr>;
export type DonneesRevocationQr = z.infer<typeof schemaRevocationQr>;