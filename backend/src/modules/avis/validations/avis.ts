import { z } from "zod";

export const schemaIdAvis = z.object({
  id: z.uuid("Identifiant d'avis invalide."),
});

export const STATUTS_TRAITEMENT = ["NOUVEAU", "EN_COURS", "TRAITE", "IGNORE"] as const;

const date = z.iso.date({ error: "La date doit etre au format AAAA-MM-JJ." });

// Dans l'adresse, un booleen s'ecrit ?negatifs=true ou ?negatifs=false.
const booleen = z
  .enum(["true", "false"], { error: "La valeur doit etre true ou false." })
  .transform((valeur) => valeur === "true");

// Filtres de la liste des avis : GET /api/v1/avis?from=...&site=...
// Les noms (from, to, site, point, questionnaire) sont les memes que ceux du tableau de bord.
export const schemaFiltresAvis = z
  .object({
    // Periode : jours complets, bornes comprises.
    from: date.optional(),
    to: date.optional(),
    site: z.uuid("Identifiant de site invalide.").optional(),
    point: z.uuid("Identifiant de point de contact invalide.").optional(),
    questionnaire: z.uuid("Identifiant de questionnaire invalide.").optional(),
    statut: z.enum(STATUTS_TRAITEMENT, { error: "Statut inconnu." }).optional(),

    // Recherche dans le commentaire.
    q: z.string().trim().min(1, "La recherche est vide.").max(100, "La recherche est trop longue.").optional(),

    // Avis negatifs (ceux qui ont declenche une alerte) et avis avec commentaire.
    negatifs: booleen.optional(),
    avec_commentaire: booleen.optional(),

    // Tranche de notes (1 a 5), par exemple pour un clic sur l'histogramme.
    note_min: z.coerce.number({ error: "La note doit etre un nombre." }).min(1).max(5).optional(),
    note_max: z.coerce.number({ error: "La note doit etre un nombre." }).min(1).max(5).optional(),

    tri: z.enum(["soumis_le", "note_globale", "nps"], { error: "Tri inconnu." }).default("soumis_le"),
    ordre: z.enum(["asc", "desc"], { error: "L'ordre doit etre asc ou desc." }).default("desc"),

    page: z.coerce.number({ error: "La page doit etre un nombre." }).int().min(1).default(1),
    limite: z.coerce
      .number({ error: "La limite doit etre un nombre." })
      .int()
      .min(1, "La limite minimale est 1.")
      .max(100, "La limite maximale est 100.")
      .default(20),
  })
  .refine((filtres) => filtres.from === undefined || filtres.to === undefined || filtres.from <= filtres.to, {
    message: "La date de debut doit etre avant la date de fin.",
    path: ["from"],
  })
  .refine(
    (filtres) =>
      filtres.note_min === undefined || filtres.note_max === undefined || filtres.note_min <= filtres.note_max,
    { message: "La note minimale doit etre inferieure a la note maximale.", path: ["note_min"] },
  );

export type FiltresAvis = z.infer<typeof schemaFiltresAvis>;