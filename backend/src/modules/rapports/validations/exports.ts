import { z } from "zod";
import { STATUTS_TRAITEMENT } from "../../avis/validations/avis";

// ------------------------------------------------------------
// Corps de POST /api/v1/exports et POST /api/v1/exports/analyse (jour 21)
// ------------------------------------------------------------
// Exemple :
// { "format": "xlsx", "langue": "fr",
//   "filtres": { "from": "2026-11-01", "to": "2026-11-30", "negatifs": true } }
// Les filtres ont les memes noms que ceux de la liste des avis (GET /avis).
// Sans from ni to : csv et xlsx exportent tous les avis ; le rapport pdf prend les 30 derniers jours.
// L'organisation et le perimetre du gestionnaire viennent de la session, jamais du corps.

const UN_JOUR_EN_MS = 24 * 60 * 60 * 1000;
const JOURS_MAX_RAPPORT = 366;

export const FORMATS_EXPORT = ["csv", "xlsx", "pdf"] as const;
export const LANGUES_EXPORT = ["fr", "en"] as const;

const date = z.iso.date({ error: "La date doit etre au format AAAA-MM-JJ." });

// Minuit UTC du jour "AAAA-MM-JJ" (Africa/Lome = UTC+0).
function jourEnMs(valeur: string): number {
  return Date.parse(`${valeur}T00:00:00.000Z`);
}

const schemaFiltresExport = z.object({
  // Periode : jours complets, bornes comprises.
  from: date.optional(),
  to: date.optional(),
  site: z.uuid("Identifiant de site invalide.").optional(),
  point: z.uuid("Identifiant de point de contact invalide.").optional(),
  questionnaire: z.uuid("Identifiant de questionnaire invalide.").optional(),
  statut: z.enum(STATUTS_TRAITEMENT, { error: "Statut inconnu." }).optional(),

  // Avis negatifs (ceux qui ont declenche une alerte) et avis avec commentaire.
  negatifs: z.boolean({ error: "negatifs doit etre true ou false." }).optional(),
  avec_commentaire: z.boolean({ error: "avec_commentaire doit etre true ou false." }).optional(),

  // Tranche de notes (1 a 5).
  note_min: z.number({ error: "La note doit etre un nombre." }).min(1, "La note minimale est 1.").max(5, "La note maximale est 5.").optional(),
  note_max: z.number({ error: "La note doit etre un nombre." }).min(1, "La note minimale est 1.").max(5, "La note maximale est 5.").optional(),

  // Recherche dans le commentaire.
  q: z.string().trim().min(1, "La recherche est vide.").max(100, "La recherche est trop longue.").optional(),
});

export const schemaDemandeExport = z
  .object({
    format: z.enum(FORMATS_EXPORT, { error: "Le format doit etre csv, xlsx ou pdf." }),
    langue: z.enum(LANGUES_EXPORT, { error: "La langue doit etre fr ou en." }).default("fr"),
    filtres: schemaFiltresExport.default({}),
  })
  .refine((demande) => (demande.filtres.from === undefined) === (demande.filtres.to === undefined), {
    message: "Envoyez from et to ensemble, ou aucun des deux.",
    path: ["filtres", "from"],
  })
  .refine(
    (demande) =>
      demande.filtres.from === undefined ||
      demande.filtres.to === undefined ||
      demande.filtres.from <= demande.filtres.to,
    { message: "La date de debut doit etre avant la date de fin.", path: ["filtres", "from"] },
  )
  .refine(
    (demande) =>
      demande.filtres.note_min === undefined ||
      demande.filtres.note_max === undefined ||
      demande.filtres.note_min <= demande.filtres.note_max,
    { message: "La note minimale doit etre inferieure a la note maximale.", path: ["filtres", "note_min"] },
  )
  .refine(
    // Le rapport pdf calcule ses indicateurs sur une periode : meme limite que le tableau de bord.
    (demande) =>
      demande.format !== "pdf" ||
      demande.filtres.from === undefined ||
      demande.filtres.to === undefined ||
      (jourEnMs(demande.filtres.to) - jourEnMs(demande.filtres.from)) / UN_JOUR_EN_MS + 1 <= JOURS_MAX_RAPPORT,
    {
      message: `La periode du rapport ne peut pas depasser ${JOURS_MAX_RAPPORT} jours.`,
      path: ["filtres", "to"],
    },
  );

// POST /exports/analyse n'a pas besoin du format : le robot analyse les memes filtres.
export const schemaDemandeAnalyse = schemaDemandeExport;

export type DemandeExport = z.infer<typeof schemaDemandeExport>;
export type FiltresExport = DemandeExport["filtres"];
export type FormatExport = (typeof FORMATS_EXPORT)[number];