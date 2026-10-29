import { prisma } from "../../../configuration/base-de-donnees";
import { arrondir, filtreAgregats, filtreAvis, type PorteeDashboard } from "./indicateurs";

// ------------------------------------------------------------
// Courbe par jour : GET /dashboard/timeseries (jour 7, etape 4d)
// ------------------------------------------------------------
// Un point par jour de la periode (jours UTC, Africa/Lome = UTC+0), y compris les
// jours sans avis (0 avis, valeurs a null) : la courbe n'a pas de trou.
//
// Sans filtre "questionnaire" : on additionne les agregats du jour (rapide).
// Avec ce filtre : on lit les avis de la periode (l'agregat n'a pas de colonne
// questionnaire).

const UN_JOUR_EN_MS = 24 * 60 * 60 * 1000;
const NPS_PROMOTEUR_MIN = 9;
const NPS_DETRACTEUR_MAX = 6;

type CumulJour = {
  nb_avis: number;
  nb_avis_notes: number;
  somme_notes: number;
  nb_nps: number;
  nb_promoteurs: number;
  nb_detracteurs: number;
};

export type PointSerie = {
  // "AAAA-MM-JJ"
  date: string;
  nb_avis: number;
  // null : aucune note ce jour-la (a ne pas afficher comme un 0).
  note_moyenne: number | null;
  nps: number | null;
};

function jourTexte(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function cumulVide(): CumulJour {
  return {
    nb_avis: 0,
    nb_avis_notes: 0,
    somme_notes: 0,
    nb_nps: 0,
    nb_promoteurs: 0,
    nb_detracteurs: 0,
  };
}

function cumulDuJour(jours: Map<string, CumulJour>, cle: string): CumulJour {
  const existant = jours.get(cle);
  if (existant) {
    return existant;
  }
  const nouveau = cumulVide();
  jours.set(cle, nouveau);
  return nouveau;
}

// Cas courant : on additionne les agregats (un par point de contact et par jour).
async function cumulsDepuisAgregats(
  portee: PorteeDashboard,
  debut: Date,
  fin: Date,
): Promise<Map<string, CumulJour>> {
  const jours = new Map<string, CumulJour>();
  const where = filtreAgregats(portee, debut, fin);
  if (where === null) {
    return jours;
  }

  const lignes = await prisma.agregatQuotidien.findMany({
    where,
    select: {
      date: true,
      nb_avis: true,
      nb_avis_notes: true,
      somme_notes: true,
      nb_nps: true,
      nb_promoteurs: true,
      nb_detracteurs: true,
    },
  });

  for (const ligne of lignes) {
    const cumul = cumulDuJour(jours, jourTexte(ligne.date));
    cumul.nb_avis += ligne.nb_avis;
    cumul.nb_avis_notes += ligne.nb_avis_notes;
    cumul.somme_notes += ligne.somme_notes;
    cumul.nb_nps += ligne.nb_nps;
    cumul.nb_promoteurs += ligne.nb_promoteurs;
    cumul.nb_detracteurs += ligne.nb_detracteurs;
  }
  return jours;
}

// Avec le filtre "questionnaire" : calcul direct depuis les avis.
async function cumulsDepuisAvis(
  portee: PorteeDashboard,
  debut: Date,
  fin: Date,
): Promise<Map<string, CumulJour>> {
  const jours = new Map<string, CumulJour>();
  const where = filtreAvis(portee, debut, fin);
  if (where === null) {
    return jours;
  }

  const avis = await prisma.avis.findMany({
    where,
    select: { soumis_le: true, note_globale: true, nps: true },
  });

  for (const ligne of avis) {
    const cumul = cumulDuJour(jours, jourTexte(ligne.soumis_le));
    cumul.nb_avis += 1;
    if (ligne.note_globale !== null) {
      cumul.nb_avis_notes += 1;
      cumul.somme_notes += ligne.note_globale;
    }
    if (ligne.nps !== null) {
      cumul.nb_nps += 1;
      if (ligne.nps >= NPS_PROMOTEUR_MIN) {
        cumul.nb_promoteurs += 1;
      } else if (ligne.nps <= NPS_DETRACTEUR_MAX) {
        cumul.nb_detracteurs += 1;
      }
    }
  }
  return jours;
}

// Un point par jour de debut (inclus) a fin (exclu).
export async function calculerSerieTemporelle(
  portee: PorteeDashboard,
  debut: Date,
  fin: Date,
): Promise<PointSerie[]> {
  const jours =
    portee.filtres.questionnaire !== undefined
      ? await cumulsDepuisAvis(portee, debut, fin)
      : await cumulsDepuisAgregats(portee, debut, fin);

  const serie: PointSerie[] = [];
  for (let instant = debut.getTime(); instant < fin.getTime(); instant += UN_JOUR_EN_MS) {
    const date = jourTexte(new Date(instant));
    const cumul = jours.get(date) ?? cumulVide();
    serie.push({
      date,
      nb_avis: cumul.nb_avis,
      note_moyenne:
        cumul.nb_avis_notes > 0 ? arrondir(cumul.somme_notes / cumul.nb_avis_notes, 2) : null,
      nps:
        cumul.nb_nps > 0
          ? arrondir(((cumul.nb_promoteurs - cumul.nb_detracteurs) / cumul.nb_nps) * 100, 1)
          : null,
    });
  }
  return serie;
}