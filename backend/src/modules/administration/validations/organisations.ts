import { z } from "zod";

// Statuts qu'on peut choisir a la creation. SUSPENDU n'en fait pas partie :
// la suspension et la reactivation ont leurs propres routes.
export const STATUTS_CREATION = ["ESSAI", "ACTIF"] as const;
export const STATUTS_ORGANISATION = ["ESSAI", "ACTIF", "SUSPENDU"] as const;

// Identifiant d'une organisation dans l'adresse (/admin/organisations/:id).
export const schemaIdOrganisation = z.object({
  id: z.uuid("Identifiant d'organisation invalide."),
});

const nom = z
  .string({ error: "Le nom est obligatoire." })
  .trim()
  .min(2, "Le nom doit contenir au moins 2 caractères.")
  .max(120, "Le nom est trop long (120 caractères maximum).");

const secteurId = z.uuid("Identifiant de secteur invalide.");

// Couleur au format #RRGGBB (exemple : #1d4ed8).
const couleur = z
  .string({ error: "La couleur doit être un texte." })
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "La couleur doit être au format #RRGGBB, par exemple #1d4ed8.");

// Pays : code a 2 lettres (TG pour le Togo). Les minuscules sont acceptees puis mises en majuscules.
const pays = z
  .string({ error: "Le pays doit être un code à 2 lettres, par exemple TG." })
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, "Le pays doit être un code à 2 lettres, par exemple TG.");

// Fuseau horaire : un nom de la base IANA (exemple : Africa/Lome).
// Intl refuse les noms inconnus en declenchant une erreur.
const fuseauHoraire = z
  .string({ error: "Le fuseau horaire doit être un texte." })
  .trim()
  .max(60, "Le fuseau horaire est trop long.")
  .refine(
    (valeur) => {
      try {
        new Intl.DateTimeFormat("fr", { timeZone: valeur });
        return true;
      } catch {
        return false;
      }
    },
    { message: "Fuseau horaire inconnu. Exemple : Africa/Lome." },
  );

const langueDefaut = z.enum(["fr", "en"], { error: "La langue doit être fr ou en." });

// POST /api/v1/admin/organisations
// Le logo n'est pas envoye ici : le premier responsable l'ajoute dans les parametres (ecran E14).
// Tout autre champ envoye est refuse (strictObject).
export const schemaCreationOrganisation = z.strictObject({
  nom,
  secteur_id: secteurId,
  couleur_principale: couleur.nullable().default(null),
  pays: pays.default("TG"),
  fuseau_horaire: fuseauHoraire.default("Africa/Lome"),
  langue_defaut: langueDefaut.default("fr"),
  statut: z.enum(STATUTS_CREATION, { error: "Le statut doit être ESSAI ou ACTIF." }).default("ESSAI"),
});

// PATCH /api/v1/admin/organisations/:id
// Le secteur et le statut ne changent pas ici : changer de secteur casserait les themes et le modele
// de l'organisation, et le statut passe par /suspendre et /reactiver.
export const schemaModificationOrganisation = z
  .strictObject({
    nom: nom.optional(),
    couleur_principale: couleur.nullable().optional(),
    pays: pays.optional(),
    fuseau_horaire: fuseauHoraire.optional(),
    langue_defaut: langueDefaut.optional(),
  })
  .refine((donnees) => Object.keys(donnees).length > 0, {
    message: "Aucune modification envoyée.",
  });

// GET /api/v1/admin/organisations?statut=...&secteur=...&q=...&page=...&limite=...
export const schemaFiltresOrganisations = z.object({
  statut: z.enum(STATUTS_ORGANISATION, { error: "Statut inconnu." }).optional(),
  secteur: secteurId.optional(),
  q: z
    .string()
    .trim()
    .min(1, "La recherche est vide.")
    .max(100, "La recherche est trop longue.")
    .optional(),
  page: z.coerce.number({ error: "La page doit être un nombre." }).int().min(1).default(1),
  limite: z.coerce
    .number({ error: "La limite doit être un nombre." })
    .int()
    .min(1, "La limite minimale est 1.")
    .max(100, "La limite maximale est 100.")
    .default(20),
});

// POST /api/v1/admin/organisations/:id/inviter-responsable
// Seule l'adresse e-mail est demandee : le role est toujours Responsable, sans site.
export const schemaInvitationPremierResponsable = z.strictObject({
  email: z
    .string({ error: "L'adresse e-mail est obligatoire." })
    .trim()
    .toLowerCase()
    .min(1, "L'adresse e-mail est obligatoire.")
    .max(254, "L'adresse e-mail est trop longue.")
    .pipe(z.email("L'adresse e-mail est invalide.")),
});

export type DonneesCreationOrganisation = z.infer<typeof schemaCreationOrganisation>;
export type DonneesModificationOrganisation = z.infer<typeof schemaModificationOrganisation>;
export type FiltresOrganisations = z.infer<typeof schemaFiltresOrganisations>;
export type DonneesInvitationPremierResponsable = z.infer<typeof schemaInvitationPremierResponsable>;