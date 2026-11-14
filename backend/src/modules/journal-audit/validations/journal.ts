import { z } from "zod";

// Codes d'action ecrits dans le journal (colonne action de audit_log).
// Les 28 premiers existent deja ; les 4 derniers sont ajoutes au jour 24 (statut d'un avis et support).
// Quand une nouvelle action est ecrite dans le journal, on l'ajoute aussi ici pour pouvoir la filtrer.
export const ACTIONS_JOURNAL = [
  // connexions
  "CONNEXION_REUSSIE",
  "CONNEXION_ECHEC",
  "COMPTE_VERROUILLE",
  "DECONNEXION",
  "REINITIALISATION_DEMANDEE",
  "REINITIALISATION_EMAIL_ECHEC",
  "MOT_DE_PASSE_REINITIALISE",
  // utilisateurs
  "UTILISATEUR_INVITE",
  "UTILISATEUR_MODIFIE",
  "UTILISATEUR_DESACTIVE",
  "UTILISATEUR_REACTIVE",
  "INVITATION_ACCEPTEE",
  "INVITATION_EMAIL_ECHEC",
  // organisations
  "ORGANISATION_CREEE",
  "ORGANISATION_MODIFIEE",
  "ORGANISATION_SUSPENDUE",
  "ORGANISATION_REACTIVEE",
  "PREMIER_RESPONSABLE_INVITE",
  "PARAMETRES_ORGANISATION_MODIFIES",
  "LOGO_ORGANISATION_MODIFIE",
  "LOGO_ORGANISATION_SUPPRIME",
  // secteurs
  "SECTEUR_CREE",
  "SECTEUR_MODIFIE",
  "THEME_CREE",
  "THEME_MODIFIE",
  // exports et QR codes
  "EXPORT_GENERE",
  "QR_REVOQUE",
  "QR_REGENERE",
  // jour 24 : avis et support
  "AVIS_STATUT_MODIFIE",
  "SUPPORT_ACCES_ACCORDE",
  "SUPPORT_ACCES_RETIRE",
  "SUPPORT_CONSULTATION",
] as const;

const date = z.iso.date({ error: "La date doit être au format AAAA-MM-JJ." });

// GET /api/v1/admin/journal-audit?page=...&limite=...&utilisateur=...&action=...&organisation=...&du=...&au=...
// Toutes les organisations sont lues (route reservee a l'administrateur DTS).
export const schemaFiltresJournal = z
  .object({
    // Auteur : morceau de son adresse e-mail (recherche partielle, sans tenir compte des majuscules).
    utilisateur: z
      .string()
      .trim()
      .min(1, "La recherche d'utilisateur est vide.")
      .max(100, "La recherche d'utilisateur est trop longue.")
      .optional(),
    action: z.enum(ACTIONS_JOURNAL, { error: "Action inconnue." }).optional(),
    organisation: z.uuid("Identifiant d'organisation invalide.").optional(),

    // Periode : jours complets, bornes comprises.
    du: date.optional(),
    au: date.optional(),

    page: z.coerce.number({ error: "La page doit être un nombre." }).int().min(1).default(1),
    limite: z.coerce
      .number({ error: "La limite doit être un nombre." })
      .int()
      .min(1, "La limite minimale est 1.")
      .max(100, "La limite maximale est 100.")
      .default(20),
  })
  .refine((filtres) => filtres.du === undefined || filtres.au === undefined || filtres.du <= filtres.au, {
    message: "La date de début doit être avant la date de fin.",
    path: ["du"],
  });

export type ActionJournal = (typeof ACTIONS_JOURNAL)[number];
export type FiltresJournal = z.infer<typeof schemaFiltresJournal>;