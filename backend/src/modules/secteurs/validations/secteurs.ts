import { z } from "zod";

// Identifiant d'un secteur dans l'adresse (/admin/secteurs/:id).
export const schemaIdSecteur = z.object({
  id: z.uuid("Identifiant de secteur invalide."),
});

// Identifiants dans l'adresse (/admin/secteurs/:id/themes/:themeId).
export const schemaIdTheme = z.object({
  id: z.uuid("Identifiant de secteur invalide."),
  themeId: z.uuid("Identifiant de thème invalide."),
});

// Code technique : minuscules, chiffres et tirets bas (exemple : qualite_plats).
const codeTechnique = z
  .string({ error: "Le code est obligatoire." })
  .trim()
  .min(2, "Le code doit contenir au moins 2 caractères.")
  .max(40, "Le code est trop long (40 caractères maximum).")
  .regex(/^[a-z][a-z0-9_]*$/, "Le code doit utiliser des minuscules, des chiffres et des tirets bas (exemple : qualite_plats).");

function nomAffiche(champ: string) {
  return z
    .string({ error: champ + " est obligatoire." })
    .trim()
    .min(2, champ + " doit contenir au moins 2 caractères.")
    .max(80, champ + " est trop long (80 caractères maximum).");
}

// Vocabulaire : mots affiches a la place des termes generiques.
// La cle point_contact est obligatoire (table, chambre, salle, stand...).
const vocabulaire = z
  .record(
    z.string().regex(/^[a-z][a-z0-9_]{0,39}$/, "Clé de vocabulaire invalide (minuscules et tirets bas)."),
    z.string().trim().min(1, "Un mot du vocabulaire est vide.").max(40, "Un mot du vocabulaire est trop long (40 caractères maximum)."),
    { error: "Le vocabulaire doit être un objet clé/mot." },
  )
  .refine((valeur) => Object.keys(valeur).length <= 10, {
    message: "Le vocabulaire contient trop d'entrées (10 maximum).",
  })
  .refine((valeur) => typeof valeur["point_contact"] === "string", {
    message: "Le vocabulaire doit contenir le mot point_contact (exemple : table).",
  });

// Indicateurs suggeres : liste de codes (exemple : nps, note_moyenne), sans doublon.
const indicateursSuggeres = z
  .array(codeTechnique, { error: "Les indicateurs suggérés doivent être une liste de codes." })
  .max(20, "Trop d'indicateurs suggérés (20 maximum).")
  .refine((liste) => new Set(liste).size === liste.length, {
    message: "Un indicateur est présent deux fois.",
  });

// POST /api/v1/admin/secteurs
export const schemaCreationSecteur = z.strictObject({
  code: codeTechnique,
  nom_fr: nomAffiche("Le nom français"),
  nom_en: nomAffiche("Le nom anglais"),
  vocabulaire: vocabulaire,
  indicateurs_suggeres: indicateursSuggeres.default([]),
  actif: z.boolean({ error: "Actif doit être vrai ou faux." }).default(true),
});

// PATCH /api/v1/admin/secteurs/:id
// Le code ne change jamais : le script de depart et le clonage des modeles s appuient dessus.
export const schemaModificationSecteur = z
  .strictObject({
    nom_fr: nomAffiche("Le nom français").optional(),
    nom_en: nomAffiche("Le nom anglais").optional(),
    vocabulaire: vocabulaire.optional(),
    indicateurs_suggeres: indicateursSuggeres.optional(),
    actif: z.boolean({ error: "Actif doit être vrai ou faux." }).optional(),
  })
  .refine((donnees) => Object.keys(donnees).length > 0, {
    message: "Aucune modification envoyée.",
  });

// POST /api/v1/admin/secteurs/:id/themes
export const schemaCreationTheme = z.strictObject({
  code: codeTechnique,
  libelle_fr: nomAffiche("Le libellé français"),
  libelle_en: nomAffiche("Le libellé anglais"),
  ordre: z.number({ error: "L'ordre doit être un nombre." }).int().min(0, "L'ordre ne peut pas être négatif.").max(999).optional(),
});

// PATCH /api/v1/admin/secteurs/:id/themes/:themeId
// Le code du theme ne change pas : les questions des modeles et les statistiques s y rattachent.
export const schemaModificationTheme = z
  .strictObject({
    libelle_fr: nomAffiche("Le libellé français").optional(),
    libelle_en: nomAffiche("Le libellé anglais").optional(),
    ordre: z.number({ error: "L'ordre doit être un nombre." }).int().min(0, "L'ordre ne peut pas être négatif.").max(999).optional(),
  })
  .refine((donnees) => Object.keys(donnees).length > 0, {
    message: "Aucune modification envoyée.",
  });

// GET /api/v1/admin/secteurs?actif=true|false
export const schemaFiltresSecteurs = z.object({
  actif: z
    .enum(["true", "false"], { error: "Le filtre actif doit être true ou false." })
    .transform((valeur) => valeur === "true")
    .optional(),
});

export type DonneesCreationSecteur = z.infer<typeof schemaCreationSecteur>;
export type DonneesModificationSecteur = z.infer<typeof schemaModificationSecteur>;
export type DonneesCreationTheme = z.infer<typeof schemaCreationTheme>;
export type DonneesModificationTheme = z.infer<typeof schemaModificationTheme>;
export type FiltresSecteurs = z.infer<typeof schemaFiltresSecteurs>;