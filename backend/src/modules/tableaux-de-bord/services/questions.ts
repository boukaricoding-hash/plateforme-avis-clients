import { Prisma } from "../../../../generated/prisma/client";
import { prisma } from "../../../configuration/base-de-donnees";
import { arrondir, filtreAvis, type PorteeDashboard } from "./indicateurs";

// ------------------------------------------------------------
// Detail par question : GET /dashboard/questions (jour 7, etape 4d)
// ------------------------------------------------------------
// Pour chaque question qui a recu des reponses dans la periode : nombre de reponses
// et repartition, plus la moyenne (etoiles, emojis, echelle, NPS), le NPS (question NPS)
// ou le pourcentage de "oui" (question oui/non).
//
// Une question change d'identifiant a chaque version du questionnaire. On fusionne
// les versions d'un meme questionnaire qui ont le meme type et le meme libelle
// francais, pour ne pas couper les chiffres en deux a chaque modification.
// Les textes libres ne donnent que le nombre de reponses (les textes sont dans la fiche d'un avis).

const NPS_PROMOTEUR_MIN = 9;
const NPS_DETRACTEUR_MAX = 6;

export type DetailQuestion = {
  questionnaire_id: string;
  type: string;
  libelle: { fr: string; en: string | null };
  ordre: number;
  echelle_min: number | null;
  echelle_max: number | null;
  nb_reponses: number;
  // null : question sans moyenne (choix, oui/non, texte libre) ou aucune reponse numerique.
  moyenne: number | null;
  // Question NPS seulement.
  nps: number | null;
  // Question oui/non seulement.
  pourcentage_oui: number | null;
  repartition: Array<{ valeur: number | string; nombre: number }>;
};

type Cumul = {
  questionnaire_id: string;
  type: string;
  libelle: { fr: string; en: string | null };
  ordre: number;
  echelle_min: number | null;
  echelle_max: number | null;
  nb_reponses: number;
  nb_numeriques: number;
  somme: number;
  valeurs: Map<number, number>;
  choix: Map<string, number>;
};

function lireLibelle(valeur: Prisma.JsonValue): { fr: string; en: string | null } {
  if (valeur !== null && typeof valeur === "object" && !Array.isArray(valeur)) {
    const fr = valeur["fr"];
    const en = valeur["en"];
    return { fr: typeof fr === "string" ? fr : "", en: typeof en === "string" ? en : null };
  }
  return { fr: "", en: null };
}

// Les choix d'une reponse : un texte (choix unique) ou une liste de textes (choix multiple).
function lireChoix(valeur: Prisma.JsonValue): string[] {
  if (typeof valeur === "string") {
    return [valeur];
  }
  if (Array.isArray(valeur)) {
    return valeur.filter((element): element is string => typeof element === "string");
  }
  return [];
}

function ajouterAuCompte<T>(compte: Map<T, number>, cle: T, nombre: number): void {
  compte.set(cle, (compte.get(cle) ?? 0) + nombre);
}

export async function calculerDetailQuestions(
  portee: PorteeDashboard,
  debut: Date,
  fin: Date,
): Promise<DetailQuestion[]> {
  const whereAvis = filtreAvis(portee, debut, fin);
  if (whereAvis === null) {
    return [];
  }

  // Les requetes se font l'une apres l'autre : on ne prend qu'une connexion a la fois.
  // 1. Reponses numeriques (etoiles, emojis, echelle, NPS, oui/non) : combien par valeur.
  const numeriques = await prisma.reponse.groupBy({
    by: ["question_id", "valeur_numerique"],
    where: {
      organisation_id: portee.organisationId,
      avis: whereAvis,
      valeur_numerique: { not: null },
    },
    _count: { _all: true },
  });

  // 2. Reponses texte libre : combien par question.
  const textes = await prisma.reponse.groupBy({
    by: ["question_id"],
    where: {
      organisation_id: portee.organisationId,
      avis: whereAvis,
      valeur_texte: { not: null },
    },
    _count: { _all: true },
  });

  // 3. Questions a choix : on lit les choix pour les compter.
  const choix = await prisma.reponse.findMany({
    where: {
      organisation_id: portee.organisationId,
      avis: whereAvis,
      question: { type: { in: ["CHOIX_UNIQUE", "CHOIX_MULTIPLE"] } },
    },
    select: { question_id: true, valeur_choix: true },
  });

  const identifiants = new Set<string>([
    ...numeriques.map((ligne) => ligne.question_id),
    ...textes.map((ligne) => ligne.question_id),
    ...choix.map((ligne) => ligne.question_id),
  ]);
  if (identifiants.size === 0) {
    return [];
  }

  const questions = await prisma.question.findMany({
    where: { id: { in: [...identifiants] } },
    select: {
      id: true,
      type: true,
      libelle: true,
      ordre: true,
      echelle_min: true,
      echelle_max: true,
      version: { select: { questionnaire_id: true } },
    },
  });
  const questionParId = new Map(questions.map((question) => [question.id, question] as const));

  // Une ligne par question fusionnee (meme questionnaire, meme type, meme libelle francais).
  const cumuls = new Map<string, Cumul>();
  const cumulDe = (questionId: string): Cumul | null => {
    const question = questionParId.get(questionId);
    if (!question) {
      return null;
    }
    const libelle = lireLibelle(question.libelle);
    const cle = question.version.questionnaire_id + "|" + question.type + "|" + libelle.fr;
    let cumul = cumuls.get(cle);
    if (!cumul) {
      cumul = {
        questionnaire_id: question.version.questionnaire_id,
        type: question.type,
        libelle,
        ordre: question.ordre,
        echelle_min: question.echelle_min,
        echelle_max: question.echelle_max,
        nb_reponses: 0,
        nb_numeriques: 0,
        somme: 0,
        valeurs: new Map<number, number>(),
        choix: new Map<string, number>(),
      };
      cumuls.set(cle, cumul);
    } else if (question.ordre < cumul.ordre) {
      cumul.ordre = question.ordre;
    }
    return cumul;
  };

  for (const ligne of numeriques) {
    const cumul = cumulDe(ligne.question_id);
    if (!cumul || ligne.valeur_numerique === null) {
      continue;
    }
    const nombre = ligne._count._all;
    cumul.nb_reponses += nombre;
    cumul.nb_numeriques += nombre;
    cumul.somme += ligne.valeur_numerique * nombre;
    ajouterAuCompte(cumul.valeurs, ligne.valeur_numerique, nombre);
  }

  for (const ligne of textes) {
    const cumul = cumulDe(ligne.question_id);
    if (cumul) {
      cumul.nb_reponses += ligne._count._all;
    }
  }

  for (const ligne of choix) {
    const cumul = cumulDe(ligne.question_id);
    if (!cumul) {
      continue;
    }
    const valeurs = lireChoix(ligne.valeur_choix);
    if (valeurs.length === 0) {
      continue;
    }
    // Une reponse = un avis, meme si elle contient plusieurs choix.
    cumul.nb_reponses += 1;
    for (const valeur of valeurs) {
      ajouterAuCompte(cumul.choix, valeur, 1);
    }
  }

  const resultat: DetailQuestion[] = [];
  for (const cumul of cumuls.values()) {
    if (cumul.nb_reponses === 0) {
      continue;
    }

    let repartition: Array<{ valeur: number | string; nombre: number }> = [];
    let moyenne: number | null = null;
    let nps: number | null = null;
    let pourcentageOui: number | null = null;

    if (cumul.type === "OUI_NON") {
      const oui = cumul.valeurs.get(1) ?? 0;
      const non = cumul.valeurs.get(0) ?? 0;
      repartition = [
        { valeur: "oui", nombre: oui },
        { valeur: "non", nombre: non },
      ];
      pourcentageOui = oui + non > 0 ? arrondir((oui / (oui + non)) * 100, 1) : null;
    } else if (cumul.type === "CHOIX_UNIQUE" || cumul.type === "CHOIX_MULTIPLE") {
      repartition = [...cumul.choix.entries()]
        .map(([valeur, nombre]) => ({ valeur, nombre }))
        .sort((a, b) => b.nombre - a.nombre || a.valeur.localeCompare(b.valeur));
    } else if (cumul.type !== "TEXTE_LIBRE") {
      repartition = [...cumul.valeurs.entries()]
        .map(([valeur, nombre]) => ({ valeur, nombre }))
        .sort((a, b) => Number(a.valeur) - Number(b.valeur));
      moyenne = cumul.nb_numeriques > 0 ? arrondir(cumul.somme / cumul.nb_numeriques, 2) : null;

      if (cumul.type === "NPS" && cumul.nb_numeriques > 0) {
        let promoteurs = 0;
        let detracteurs = 0;
        for (const [valeur, nombre] of cumul.valeurs) {
          if (valeur >= NPS_PROMOTEUR_MIN) {
            promoteurs += nombre;
          } else if (valeur <= NPS_DETRACTEUR_MAX) {
            detracteurs += nombre;
          }
        }
        nps = arrondir(((promoteurs - detracteurs) / cumul.nb_numeriques) * 100, 1);
      }
    }

    resultat.push({
      questionnaire_id: cumul.questionnaire_id,
      type: cumul.type,
      libelle: cumul.libelle,
      ordre: cumul.ordre,
      echelle_min: cumul.echelle_min,
      echelle_max: cumul.echelle_max,
      nb_reponses: cumul.nb_reponses,
      moyenne,
      nps,
      pourcentage_oui: pourcentageOui,
      repartition,
    });
  }

  // Par questionnaire, puis dans l'ordre des questions.
  resultat.sort(
    (a, b) => a.questionnaire_id.localeCompare(b.questionnaire_id) || a.ordre - b.ordre,
  );
  return resultat;
}