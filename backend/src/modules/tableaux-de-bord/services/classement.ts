import { prisma } from "../../../configuration/base-de-donnees";
import { arrondir, filtreAgregats, filtreAvis, type PorteeDashboard } from "./indicateurs";

// ------------------------------------------------------------
// Classement des points de contact : GET /dashboard/ranking (jour 7, etape 4d)
// ------------------------------------------------------------
// Un point de contact (table, chambre, stand...) par ligne, avec ses chiffres
// de la periode. Seuls les points qui ont au moins un avis apparaissent.
// Tri par defaut : meilleure note d'abord, les points sans note a la fin.
//
// Sans filtre "questionnaire" : on additionne les agregats (rapide).
// Avec ce filtre : on lit les avis de la periode (l'agregat n'a pas de colonne
// questionnaire).

const NOTE_SATISFAIT_MIN = 4;
const NPS_PROMOTEUR_MIN = 9;
const NPS_DETRACTEUR_MAX = 6;

type Cumul = {
  nb_avis: number;
  nb_avis_notes: number;
  somme_notes: number;
  nb_satisfaits: number;
  nb_nps: number;
  nb_promoteurs: number;
  nb_detracteurs: number;
};

export type LigneClassement = {
  point_contact_id: string;
  nom: string;
  type: string;
  site_id: string;
  site_nom: string;
  nb_avis: number;
  // null : aucune note (a ne pas afficher comme un 0).
  note_moyenne: number | null;
  csat: number | null;
  nps: number | null;
};

function cumulVide(): Cumul {
  return {
    nb_avis: 0,
    nb_avis_notes: 0,
    somme_notes: 0,
    nb_satisfaits: 0,
    nb_nps: 0,
    nb_promoteurs: 0,
    nb_detracteurs: 0,
  };
}

// Cas courant : on additionne les agregats, regroupes par point de contact.
async function cumulsDepuisAgregats(
  portee: PorteeDashboard,
  debut: Date,
  fin: Date,
): Promise<Map<string, Cumul>> {
  const points = new Map<string, Cumul>();
  const where = filtreAgregats(portee, debut, fin);
  if (where === null) {
    return points;
  }

  const groupes = await prisma.agregatQuotidien.groupBy({
    by: ["point_contact_id"],
    where,
    _sum: {
      nb_avis: true,
      nb_avis_notes: true,
      somme_notes: true,
      nb_satisfaits: true,
      nb_nps: true,
      nb_promoteurs: true,
      nb_detracteurs: true,
    },
  });

  for (const groupe of groupes) {
    points.set(groupe.point_contact_id, {
      nb_avis: groupe._sum.nb_avis ?? 0,
      nb_avis_notes: groupe._sum.nb_avis_notes ?? 0,
      somme_notes: groupe._sum.somme_notes ?? 0,
      nb_satisfaits: groupe._sum.nb_satisfaits ?? 0,
      nb_nps: groupe._sum.nb_nps ?? 0,
      nb_promoteurs: groupe._sum.nb_promoteurs ?? 0,
      nb_detracteurs: groupe._sum.nb_detracteurs ?? 0,
    });
  }
  return points;
}

// Avec le filtre "questionnaire" : calcul direct depuis les avis.
async function cumulsDepuisAvis(
  portee: PorteeDashboard,
  debut: Date,
  fin: Date,
): Promise<Map<string, Cumul>> {
  const points = new Map<string, Cumul>();
  const where = filtreAvis(portee, debut, fin);
  if (where === null) {
    return points;
  }

  const avis = await prisma.avis.findMany({
    where,
    select: { point_contact_id: true, note_globale: true, nps: true },
  });

  for (const ligne of avis) {
    let cumul = points.get(ligne.point_contact_id);
    if (!cumul) {
      cumul = cumulVide();
      points.set(ligne.point_contact_id, cumul);
    }
    cumul.nb_avis += 1;
    if (ligne.note_globale !== null) {
      cumul.nb_avis_notes += 1;
      cumul.somme_notes += ligne.note_globale;
      if (ligne.note_globale >= NOTE_SATISFAIT_MIN) {
        cumul.nb_satisfaits += 1;
      }
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
  return points;
}

export async function calculerClassement(
  portee: PorteeDashboard,
  debut: Date,
  fin: Date,
): Promise<LigneClassement[]> {
  const cumuls =
    portee.filtres.questionnaire !== undefined
      ? await cumulsDepuisAvis(portee, debut, fin)
      : await cumulsDepuisAgregats(portee, debut, fin);

  // Seuls les points qui ont au moins un avis (un agregat peut n'avoir que des scans).
  const identifiants = [...cumuls.entries()]
    .filter(([, cumul]) => cumul.nb_avis > 0)
    .map(([identifiant]) => identifiant);
  if (identifiants.length === 0) {
    return [];
  }

  // L'organisation est reverifiee : un identifiant d'une autre organisation n'apparait jamais.
  const points = await prisma.pointContact.findMany({
    where: { id: { in: identifiants }, organisation_id: portee.organisationId },
    select: { id: true, nom: true, type: true, site_id: true, site: { select: { nom: true } } },
  });

  const lignes: LigneClassement[] = [];
  for (const point of points) {
    const cumul = cumuls.get(point.id);
    if (!cumul) {
      continue;
    }
    lignes.push({
      point_contact_id: point.id,
      nom: point.nom,
      type: point.type,
      site_id: point.site_id,
      site_nom: point.site.nom,
      nb_avis: cumul.nb_avis,
      note_moyenne:
        cumul.nb_avis_notes > 0 ? arrondir(cumul.somme_notes / cumul.nb_avis_notes, 2) : null,
      csat:
        cumul.nb_avis_notes > 0 ? arrondir((cumul.nb_satisfaits / cumul.nb_avis_notes) * 100, 1) : null,
      nps:
        cumul.nb_nps > 0
          ? arrondir(((cumul.nb_promoteurs - cumul.nb_detracteurs) / cumul.nb_nps) * 100, 1)
          : null,
    });
  }

  // Meilleure note d'abord (sans note a la fin), puis le plus d'avis, puis l'ordre alphabetique.
  lignes.sort((a, b) => {
    if (a.note_moyenne === null && b.note_moyenne !== null) return 1;
    if (a.note_moyenne !== null && b.note_moyenne === null) return -1;
    const ecart = (b.note_moyenne ?? 0) - (a.note_moyenne ?? 0);
    return ecart || b.nb_avis - a.nb_avis || a.nom.localeCompare(b.nom);
  });
  return lignes;
}