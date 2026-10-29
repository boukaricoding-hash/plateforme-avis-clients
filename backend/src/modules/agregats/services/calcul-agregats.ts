import { Prisma } from "../../../../generated/prisma/client";
import { prisma } from "../../../configuration/base-de-donnees";

// ------------------------------------------------------------
// Agregats quotidiens (jour 7)
// ------------------------------------------------------------
// Une ligne de agregat_quotidien = un point de contact pour un jour.
// Le tableau de bord additionne ces lignes au lieu de relire tous les avis.
//
// - La note moyenne et la satisfaction (CSAT) sont comptees par avis,
//   a partir de avis.note_globale (moyenne sur 5 des questions notees).
//   Un avis est "satisfait" si sa note globale est de 4 ou plus.
// - Le NPS vient de avis.nps : promoteur = 9 ou 10, detracteur = 0 a 6.
// - scores_themes garde { somme, nb } par theme (jamais une moyenne),
//   pour pouvoir additionner plusieurs jours sans fausser le calcul.
// - Les jours sont des jours UTC (Africa/Lome = UTC+0).

const UN_JOUR_EN_MS = 24 * 60 * 60 * 1000;
const NOTE_SATISFAIT_MIN = 4;
const NPS_PROMOTEUR_MIN = 9;
const NPS_DETRACTEUR_MAX = 6;

type ScoreTheme = { somme: number; nb: number };

// Minuit UTC du jour de la date donnee.
export function debutDuJourUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function arrondir(valeur: number, decimales: number): number {
  const facteur = 10 ** decimales;
  return Math.round(valeur * facteur) / facteur;
}

// ------------------------------------------------------------
// Un point de contact, un jour
// ------------------------------------------------------------

// Recalcule entierement la ligne du point de contact pour le jour de "jour".
// Peut etre relance autant de fois que l'on veut : le resultat est toujours le meme.
export async function recalculerAgregat(pointContactId: string, jour: Date): Promise<void> {
  const debut = debutDuJourUtc(jour);
  const fin = new Date(debut.getTime() + UN_JOUR_EN_MS);

  const point = await prisma.pointContact.findUnique({
    where: { id: pointContactId },
    select: { organisation_id: true, site_id: true },
  });
  if (!point) {
    return;
  }

  const filtreAvis: Prisma.AvisWhereInput = {
    point_contact_id: pointContactId,
    soumis_le: { gte: debut, lt: fin },
    supprime_le: null,
  };

  // Les requetes se font l'une apres l'autre : on ne prend qu'une connexion a la fois.
  const nbAvis = await prisma.avis.count({ where: filtreAvis });
  const nbScans = await prisma.scan.count({
    where: { point_contact_id: pointContactId, cree_le: { gte: debut, lt: fin } },
  });

  // Plus rien ce jour-la (par exemple avis supprime) : on retire la ligne.
  if (nbAvis === 0 && nbScans === 0) {
    await prisma.agregatQuotidien.deleteMany({
      where: { point_contact_id: pointContactId, date: debut },
    });
    return;
  }

  // 1. Notes globales : moyenne, satisfaction, histogramme de 1 a 5.
  const parNote = await prisma.avis.groupBy({
    by: ["note_globale"],
    where: { ...filtreAvis, note_globale: { not: null } },
    _count: { _all: true },
  });

  let nbAvisNotes = 0;
  let sommeNotes = 0;
  let nbSatisfaits = 0;
  const repartition: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };

  for (const groupe of parNote) {
    const note = groupe.note_globale;
    const nombre = groupe._count._all;
    if (note === null) {
      continue;
    }
    nbAvisNotes += nombre;
    sommeNotes += note * nombre;
    if (note >= NOTE_SATISFAIT_MIN) {
      nbSatisfaits += nombre;
    }
    const cle = String(Math.min(5, Math.max(1, Math.round(note))));
    repartition[cle] = (repartition[cle] ?? 0) + nombre;
  }

  // 2. NPS : promoteurs et detracteurs.
  const parNps = await prisma.avis.groupBy({
    by: ["nps"],
    where: { ...filtreAvis, nps: { not: null } },
    _count: { _all: true },
  });

  let nbNps = 0;
  let nbPromoteurs = 0;
  let nbDetracteurs = 0;

  for (const groupe of parNps) {
    const valeur = groupe.nps;
    const nombre = groupe._count._all;
    if (valeur === null) {
      continue;
    }
    nbNps += nombre;
    if (valeur >= NPS_PROMOTEUR_MIN) {
      nbPromoteurs += nombre;
    } else if (valeur <= NPS_DETRACTEUR_MAX) {
      nbDetracteurs += nombre;
    }
  }

  // 3. Scores par theme : reponses numeriques des questions etoiles, emojis et echelle.
  const parQuestion = await prisma.reponse.groupBy({
    by: ["question_id"],
    where: {
      avis: filtreAvis,
      valeur_numerique: { not: null },
      question: { type: { in: ["ETOILES", "EMOJIS", "ECHELLE"] }, theme_id: { not: null } },
    },
    _sum: { valeur_numerique: true },
    _count: { valeur_numerique: true },
  });

  const questions = await prisma.question.findMany({
    where: { id: { in: parQuestion.map((groupe) => groupe.question_id) } },
    select: { id: true, type: true, theme_id: true, echelle_min: true, echelle_max: true },
  });
  const questionParId = new Map(questions.map((question) => [question.id, question] as const));

  const scoresThemes: Record<string, ScoreTheme> = {};

  for (const groupe of parQuestion) {
    const question = questionParId.get(groupe.question_id);
    const nombre = groupe._count.valeur_numerique;
    if (!question || question.theme_id === null || nombre === 0) {
      continue;
    }

    const somme = groupe._sum.valeur_numerique ?? 0;
    let sommeSur5 = somme;
    if (question.type === "ECHELLE") {
      // Ramene l'echelle sur 5 : (valeur - min) / (max - min) * 4 + 1, additionne sur les reponses.
      const min = question.echelle_min ?? 1;
      const max = question.echelle_max ?? 5;
      if (max <= min) {
        continue;
      }
      sommeSur5 = ((somme - nombre * min) / (max - min)) * 4 + nombre;
    }

    const actuel = scoresThemes[question.theme_id] ?? { somme: 0, nb: 0 };
    scoresThemes[question.theme_id] = {
      somme: actuel.somme + sommeSur5,
      nb: actuel.nb + nombre,
    };
  }

  for (const [themeId, score] of Object.entries(scoresThemes)) {
    scoresThemes[themeId] = { somme: arrondir(score.somme, 4), nb: score.nb };
  }

  // 4. Enregistrement (cree la ligne ou la remplace).
  const repartitionNotes: Prisma.InputJsonObject = repartition;
  const scoresThemesJson: Prisma.InputJsonObject = scoresThemes;

  const valeurs = {
    nb_avis: nbAvis,
    nb_avis_notes: nbAvisNotes,
    somme_notes: arrondir(sommeNotes, 4),
    nb_satisfaits: nbSatisfaits,
    nb_nps: nbNps,
    nb_promoteurs: nbPromoteurs,
    nb_detracteurs: nbDetracteurs,
    nb_scans: nbScans,
    repartition_notes: repartitionNotes,
    scores_themes: scoresThemesJson,
  };

  await prisma.agregatQuotidien.upsert({
    where: { point_contact_id_date: { point_contact_id: pointContactId, date: debut } },
    create: {
      organisation_id: point.organisation_id,
      site_id: point.site_id,
      point_contact_id: pointContactId,
      date: debut,
      ...valeurs,
    },
    update: valeurs,
  });
}

// ------------------------------------------------------------
// Tous les points de contact d'un jour (tache de nuit)
// ------------------------------------------------------------

// Recalcule tous les points de contact qui ont eu un avis ou un scan ce jour-la,
// plus ceux qui ont deja une ligne (pour la corriger ou la retirer).
// Renvoie le nombre de points de contact traites.
export async function recalculerAgregatsDuJour(jour: Date): Promise<number> {
  const debut = debutDuJourUtc(jour);
  const fin = new Date(debut.getTime() + UN_JOUR_EN_MS);

  const avis = await prisma.avis.findMany({
    where: { soumis_le: { gte: debut, lt: fin }, supprime_le: null },
    select: { point_contact_id: true },
    distinct: ["point_contact_id"],
  });
  const scans = await prisma.scan.findMany({
    where: { cree_le: { gte: debut, lt: fin } },
    select: { point_contact_id: true },
    distinct: ["point_contact_id"],
  });
  const existants = await prisma.agregatQuotidien.findMany({
    where: { date: debut },
    select: { point_contact_id: true },
  });

  const points = new Set<string>([
    ...avis.map((ligne) => ligne.point_contact_id),
    ...scans.map((ligne) => ligne.point_contact_id),
    ...existants.map((ligne) => ligne.point_contact_id),
  ]);

  // Un par un : on ne sature pas la connexion a la base.
  for (const pointContactId of points) {
    await recalculerAgregat(pointContactId, debut);
  }
  return points.size;
}

// ------------------------------------------------------------
// Plusieurs jours (script de demonstration, rattrapage)
// ------------------------------------------------------------

// Recalcule chaque jour de premierJour a dernierJour (bornes comprises).
// Renvoie le nombre total de points de contact traites.
export async function recalculerAgregatsPeriode(
  premierJour: Date,
  dernierJour: Date,
): Promise<number> {
  const dernier = debutDuJourUtc(dernierJour).getTime();
  let total = 0;
  for (let instant = debutDuJourUtc(premierJour).getTime(); instant <= dernier; instant += UN_JOUR_EN_MS) {
    total += await recalculerAgregatsDuJour(new Date(instant));
  }
  return total;
}