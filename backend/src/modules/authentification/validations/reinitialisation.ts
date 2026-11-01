import { z } from "zod";

// Demande de lien : seulement l'adresse e-mail.
export const schemaDemandeReinitialisation = z.object({
  email: z.string().trim().toLowerCase().min(1, "L'adresse e-mail est obligatoire.").max(254),
});

// Nouveau mot de passe.
// Un jeton absent ou invalide devient une chaine vide : le controleur repondra
// LIEN_INVALIDE (et non DONNEES_INVALIDES), comme le contrat le demande.
// Un mot de passe absent devient une chaine vide : validerMotDePasse donnera le message.
export const schemaReinitialisation = z.object({
  jeton: z.string().trim().max(500).catch(""),
  mot_de_passe: z.string().max(200).default(""),
});

export type DonneesDemandeReinitialisation = z.infer<typeof schemaDemandeReinitialisation>;
export type DonneesReinitialisation = z.infer<typeof schemaReinitialisation>;