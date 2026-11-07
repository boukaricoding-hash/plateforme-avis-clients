import { z } from "zod";

// Roles que le Responsable peut donner. ADMINISTRATEUR (DTS) n'est jamais propose ici.
const roleInvitable = z.enum(["RESPONSABLE", "GESTIONNAIRE"], {
  error: "Le role doit etre RESPONSABLE ou GESTIONNAIRE.",
});

// Liste de sites : identifiants valides, sans doublon, 50 au plus.
const listeSites = z
  .array(z.uuid("Identifiant de site invalide."), { error: "La liste des sites est invalide." })
  .max(50, "Trop de sites (50 au plus).")
  .transform((ids) => Array.from(new Set(ids)));

const emailInvite = z
  .string({ error: "L'adresse e-mail est obligatoire." })
  .trim()
  .toLowerCase()
  .min(1, "L'adresse e-mail est obligatoire.")
  .max(254, "L'adresse e-mail est trop longue.")
  .pipe(z.email("L'adresse e-mail est invalide."));

// Identifiant d'un utilisateur dans l'adresse (/utilisateurs/:id).
export const schemaIdUtilisateur = z.object({
  id: z.uuid("Identifiant d'utilisateur invalide."),
});

// Invitation : un Gestionnaire doit avoir au moins un site.
// Un Responsable voit toute l'organisation : ses sites eventuels sont ignores.
export const schemaInvitation = z
  .strictObject({
    email: emailInvite,
    role: roleInvitable,
    site_ids: listeSites.default([]),
  })
  .superRefine((donnees, contexte) => {
    if (donnees.role === "GESTIONNAIRE" && donnees.site_ids.length === 0) {
      contexte.addIssue({
        code: "custom",
        path: ["site_ids"],
        message: "Un gestionnaire doit avoir au moins un site.",
      });
    }
  })
  .transform((donnees) => ({
    ...donnees,
    site_ids: donnees.role === "RESPONSABLE" ? [] : donnees.site_ids,
  }));

// Verification d'un lien d'invitation (page publique) : le jeton vient de l'adresse (?jeton=...).
// Un jeton absent devient une chaine vide : le controleur repondra LIEN_INVALIDE.
export const schemaVerificationInvitation = z.object({
  jeton: z.string().trim().max(500).catch(""),
});

// Acceptation : l'invite donne son nom et choisit son mot de passe.
// Un mot de passe absent devient une chaine vide : validerMotDePasse donnera le message.
export const schemaAcceptationInvitation = z.object({
  jeton: z.string().trim().max(500).catch(""),
  nom: z
    .string({ error: "Le nom est obligatoire." })
    .trim()
    .min(1, "Le nom est obligatoire.")
    .max(120, "Le nom est trop long (120 caracteres maximum)."),
  mot_de_passe: z.string().max(200).default(""),
});

// Modification : role et/ou sites. La coherence role/sites est verifiee dans le service,
// car elle depend du role actuel de l'utilisateur.
export const schemaModificationUtilisateur = z
  .strictObject({
    role: roleInvitable.optional(),
    site_ids: listeSites.optional(),
  })
  .refine((donnees) => Object.keys(donnees).length > 0, {
    message: "Aucune modification envoyee.",
  });

export type DonneesInvitation = z.infer<typeof schemaInvitation>;
export type DonneesAcceptationInvitation = z.infer<typeof schemaAcceptationInvitation>;
export type DonneesModificationUtilisateur = z.infer<typeof schemaModificationUtilisateur>;