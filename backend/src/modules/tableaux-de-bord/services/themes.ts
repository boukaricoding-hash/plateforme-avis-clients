import { Prisma } from "../../../../generated/prisma/client";
import { prisma } from "../../../configuration/base-de-donnees";
import { arrondir, filtreAgregats, filtreAvis, type PorteeDashboard } from "./indicateurs";

// ------------------------------------------------------------
// Score par theme : GET /dashboard/themes (jour 7, etape 4d)
// ------------------------------------------------------------
// Le score d'un theme est la moyenne (sur 5) des reponses aux questions notees
// (etoiles, emojis, echelle) de ce theme. On garde { somme, nb } et jamais une
// moyenne, pour pouvoir additionner plusieurs jours sans fausser le calcul.
// Les points faibles (scores les plus bas) viennent en premier.
//
// Sans filtre "questionnaire" : on additionne scores_themes des agregats (rapide).
// Avec ce filtre : on recalcule depuis les reponses (l'agregat n'a pas de colonne
// questionnaire).

type SommeTheme = { somme: number; nb: number };

export type ScoreTheme = {
  theme_id: string;
  code: string;
  libelle_fr: string;
  libelle_en: string;
  // Moyenne sur 5, arrondie a 2 decimales.
  score: number;
  nb_reponses: number;
};

// Lit le JSON { "<theme_id>": { somme, nb } } enregistre dans l'agregat.
function lireScoresThemes(valeur: Prisma.JsonValue): Record<string, SommeTheme> {
  const resultat: Record<string, SommeTheme> = {};
  if (valeur === null || typeof valeur !== "object" || Array.isArray(valeur)) {
    return resultat;
  }
  for (const [themeId, brut] of Object.entries(valeur)) {
    if (brut !== null && typeof brut === "object" && !Array.isArray(brut)) {
      const somme = brut["somme"];
      const nb = brut["nb"];
      if (typeof somme === "number" && typeof nb === "number") {
        resultat[themeId] = { somme, nb };
      }
    }
  }
  return resultat;
}

function ajouter(sommes: Record<string, SommeTheme>, themeId: string, somme: number, nb: number): void {
  const actuel = sommes[themeId] ?? { somme: 0, nb: 0 };
  sommes[themeId] = { somme: actuel.somme + somme, nb: actuel.nb + nb };
}

// Cas courant : on additionne les agregats de la periode.
async function sommesDepuisAgregats(
  portee: PorteeDashboard,
  debut: Date,
  fin: Date,
): Promise<Record<string, SommeTheme>> {
  const sommes: Record<string, SommeTheme> = {};
  const where = filtreAgregats(portee, debut, fin);
  if (where === null) {
    return sommes;
  }

  const lignes = await prisma.agregatQuotidien.findMany({
    where,
    select: { scores_themes: true },
  });
  for (const ligne of lignes) {
    for (const [themeId, score] of Object.entries(lireScoresThemes(ligne.scores_themes))) {
      ajouter(sommes, themeId, score.somme, score.nb);
    }
  }
  return sommes;
}

// Avec le filtre "questionnaire" : calcul direct depuis les reponses.
async function sommesDepuisReponses(
  portee: PorteeDashboard,
  debut: Date,
  fin: Date,
): Promise<Record<string, SommeTheme>> {
  const sommes: Record<string, SommeTheme> = {};
  const whereAvis = filtreAvis(portee, debut, fin);
  if (whereAvis === null) {
    return sommes;
  }

  const parQuestion = await prisma.reponse.groupBy({
    by: ["question_id"],
    where: {
      avis: whereAvis,
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

  for (const groupe of parQuestion) {
    const question = questionParId.get(groupe.question_id);
    const nombre = groupe._count.valeur_numerique;
    if (!question || question.theme_id === null || nombre === 0) {
      continue;
    }

    const somme = groupe._sum.valeur_numerique ?? 0;
    let sommeSur5 = somme;
    if (question.type === "ECHELLE") {
      // Meme conversion que les agregats : (valeur - min) / (max - min) * 4 + 1, additionne.
      const min = question.echelle_min ?? 1;
      const max = question.echelle_max ?? 5;
      if (max <= min) {
        continue;
      }
      sommeSur5 = ((somme - nombre * min) / (max - min)) * 4 + nombre;
    }
    ajouter(sommes, question.theme_id, sommeSur5, nombre);
  }
  return sommes;
}

// Scores par theme, du plus faible au meilleur.
export async function calculerScoresThemes(
  portee: PorteeDashboard,
  debut: Date,
  fin: Date,
): Promise<ScoreTheme[]> {
  const sommes =
    portee.filtres.questionnaire !== undefined
      ? await sommesDepuisReponses(portee, debut, fin)
      : await sommesDepuisAgregats(portee, debut, fin);

  const identifiants = Object.keys(sommes);
  if (identifiants.length === 0) {
    return [];
  }

  const themes = await prisma.theme.findMany({
    where: { id: { in: identifiants } },
    select: { id: true, code: true, libelle_fr: true, libelle_en: true },
  });

  const resultat: ScoreTheme[] = [];
  for (const theme of themes) {
    const somme = sommes[theme.id];
    if (!somme || somme.nb === 0) {
      continue;
    }
    resultat.push({
      theme_id: theme.id,
      code: theme.code,
      libelle_fr: theme.libelle_fr,
      libelle_en: theme.libelle_en,
      score: arrondir(somme.somme / somme.nb, 2),
      nb_reponses: somme.nb,
    });
  }

  // Points faibles d'abord ; a score egal, le theme le plus repondu, puis l'ordre alphabetique.
  resultat.sort(
    (a, b) =>
      a.score - b.score || b.nb_reponses - a.nb_reponses || a.libelle_fr.localeCompare(b.libelle_fr),
  );
  return resultat;
}