import { z } from "zod";

// Filtres communs a toutes les routes /dashboard/* :
// ?from=2026-11-01&to=2026-11-30&site=...&point=...&questionnaire=...
// Les noms sont les memes que ceux de la liste des avis.

const UN_JOUR_EN_MS = 24 * 60 * 60 * 1000;
const JOURS_PAR_DEFAUT = 30;
const JOURS_MAX = 366;

const date = z.iso.date({ error: "La date doit etre au format AAAA-MM-JJ." });

// Minuit UTC du jour "AAAA-MM-JJ" (Africa/Lome = UTC+0).
function jourEnMs(valeur: string): number {
  return Date.parse(`${valeur}T00:00:00.000Z`);
}

export const schemaFiltresDashboard = z
  .object({
    from: date.optional(),
    to: date.optional(),
    site: z.uuid("Identifiant de site invalide.").optional(),
    point: z.uuid("Identifiant de point de contact invalide.").optional(),
    questionnaire: z.uuid("Identifiant de questionnaire invalide.").optional(),
  })
  .refine((filtres) => (filtres.from === undefined) === (filtres.to === undefined), {
    message: "Envoyez from et to ensemble, ou aucun des deux (30 derniers jours).",
    path: ["from"],
  })
  .refine(
    (filtres) => filtres.from === undefined || filtres.to === undefined || filtres.from <= filtres.to,
    { message: "La date de debut doit etre avant la date de fin.", path: ["from"] },
  )
  .refine(
    (filtres) =>
      filtres.from === undefined ||
      filtres.to === undefined ||
      (jourEnMs(filtres.to) - jourEnMs(filtres.from)) / UN_JOUR_EN_MS + 1 <= JOURS_MAX,
    { message: `La periode ne peut pas depasser ${JOURS_MAX} jours.`, path: ["to"] },
  );

export type FiltresDashboard = z.infer<typeof schemaFiltresDashboard>;

// ------------------------------------------------------------
// Periode
// ------------------------------------------------------------

export type PeriodeDashboard = {
  // Minuit UTC du premier jour (inclus).
  debut: Date;
  // Minuit UTC du lendemain du dernier jour (exclu).
  fin: Date;
  // Debut de la periode precedente, de meme duree, qui se termine a "debut" (exclu).
  debut_precedent: Date;
  nombre_jours: number;
  // Minuit UTC d'aujourd'hui.
  aujourdhui: Date;
};

// Sans from ni to : les 30 derniers jours, aujourd'hui compris.
export function resoudrePeriode(
  filtres: FiltresDashboard,
  maintenant: Date = new Date(),
): PeriodeDashboard {
  const aujourdhui = Date.UTC(
    maintenant.getUTCFullYear(),
    maintenant.getUTCMonth(),
    maintenant.getUTCDate(),
  );

  const dernierJour = filtres.to !== undefined ? jourEnMs(filtres.to) : aujourdhui;
  const premierJour =
    filtres.from !== undefined
      ? jourEnMs(filtres.from)
      : dernierJour - (JOURS_PAR_DEFAUT - 1) * UN_JOUR_EN_MS;

  const fin = dernierJour + UN_JOUR_EN_MS;
  const duree = fin - premierJour;

  return {
    debut: new Date(premierJour),
    fin: new Date(fin),
    debut_precedent: new Date(premierJour - duree),
    nombre_jours: duree / UN_JOUR_EN_MS,
    aujourdhui: new Date(aujourdhui),
  };
}