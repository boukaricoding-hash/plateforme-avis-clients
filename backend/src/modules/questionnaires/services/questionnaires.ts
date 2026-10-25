import type { Prisma } from "../../../../generated/prisma/client";
import { prisma } from "../../../configuration/base-de-donnees";
import type { DonneesQuestion, DonneesQuestionnaire } from "../validations/questionnaire";

// Convertit un objet valide en JSON accepte par Prisma (retire les champs undefined).
function json(valeur: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(valeur)) as Prisma.InputJsonValue;
}

function bornes(question: DonneesQuestion): { min: number | null; max: number | null } {
  switch (question.type) {
    case "ETOILES":
    case "EMOJIS":
      return { min: 1, max: 5 };
    case "NPS":
      return { min: 0, max: 10 };
    case "ECHELLE":
      return { min: question.echelle_min ?? null, max: question.echelle_max ?? null };
    default:
      return { min: null, max: null };
  }
}

// Transforme une question recue en ligne de la table question.
export function donneesQuestion(
  question: DonneesQuestion,
  index: number,
  versionId: string,
): Prisma.QuestionCreateManyInput {
  const limites = bornes(question);
  return {
    version_id: versionId,
    ordre: index + 1,
    type: question.type,
    libelle: json(question.libelle),
    obligatoire: question.obligatoire,
    theme_id: question.theme_id ?? null,
    echelle_min: limites.min,
    echelle_max: limites.max,
    ...(question.aide !== undefined ? { aide: json(question.aide) } : {}),
    ...(question.options !== undefined ? { options: json(question.options) } : {}),
    ...(question.libelles_extremites !== undefined
      ? { libelles_extremites: json(question.libelles_extremites) }
      : {}),
  };
}

// Vrai si tous les themes choisis appartiennent au secteur de l'organisation.
export async function themesValides(
  organisationId: string,
  questions: DonneesQuestion[],
): Promise<boolean> {
  const idsThemes = [
    ...new Set(questions.flatMap((question) => (question.theme_id ? [question.theme_id] : []))),
  ];
  if (idsThemes.length === 0) {
    return true;
  }
  const organisation = await prisma.organisation.findUniqueOrThrow({
    where: { id: organisationId },
    select: { secteur_id: true },
  });
  const nombre = await prisma.theme.count({
    where: { id: { in: idsThemes }, secteur_id: organisation.secteur_id },
  });
  return nombre === idsThemes.length;
}

// Cree le questionnaire (brouillon), sa version 1 et ses questions. Renvoie l'identifiant.
export async function creerQuestionnaire(
  organisationId: string,
  donnees: DonneesQuestionnaire,
): Promise<string> {
  return prisma.$transaction(async (tx) => {
    const questionnaire = await tx.questionnaire.create({
      data: {
        organisation_id: organisationId,
        titre: json(donnees.titre),
        langue_defaut: donnees.langue_defaut,
        ...(donnees.message_accueil !== undefined
          ? { message_accueil: json(donnees.message_accueil) }
          : {}),
        ...(donnees.message_remerciement !== undefined
          ? { message_remerciement: json(donnees.message_remerciement) }
          : {}),
      },
      select: { id: true },
    });

    const version = await tx.questionnaireVersion.create({
      data: { questionnaire_id: questionnaire.id, numero: 1 },
      select: { id: true },
    });

    await tx.question.createMany({
      data: donnees.questions.map((question, index) =>
        donneesQuestion(question, index, version.id),
      ),
    });

    return questionnaire.id;
  });
}
export async function listerQuestionnaires(organisationId: string) {
  const questionnaires = await prisma.questionnaire.findMany({
    where: { organisation_id: organisationId, supprime_le: null },
    select: {
      id: true,
      titre: true,
      statut: true,
      langue_defaut: true,
      date_debut: true,
      date_fin: true,
      cree_le: true,
      modifie_le: true,
      versions: {
        select: { numero: true, publie_le: true },
        orderBy: { numero: "desc" },
        take: 1,
      },
      _count: { select: { points_contact: { where: { supprime_le: null } } } },
    },
    orderBy: { modifie_le: "desc" },
  });

  return questionnaires.map(({ versions, _count, ...questionnaire }) => ({
    ...questionnaire,
    version: versions[0] ?? null,
    nombre_points_contact: _count.points_contact,
  }));
}

// Renvoie null si le questionnaire n'existe pas dans CETTE organisation.
export async function lireQuestionnaire(organisationId: string, questionnaireId: string) {
  const questionnaire = await prisma.questionnaire.findFirst({
    where: { id: questionnaireId, organisation_id: organisationId, supprime_le: null },
    select: {
      id: true,
      titre: true,
      message_accueil: true,
      message_remerciement: true,
      langue_defaut: true,
      statut: true,
      date_debut: true,
      date_fin: true,
      cree_le: true,
      modifie_le: true,
      versions: {
        orderBy: { numero: "desc" },
        take: 1,
        select: {
          id: true,
          numero: true,
          publie_le: true,
          questions: {
            orderBy: { ordre: "asc" },
            select: {
              id: true,
              ordre: true,
              type: true,
              libelle: true,
              aide: true,
              obligatoire: true,
              options: true,
              echelle_min: true,
              echelle_max: true,
              libelles_extremites: true,
              theme: { select: { id: true, code: true, libelle_fr: true, libelle_en: true } },
            },
          },
        },
      },
      points_contact: { where: { supprime_le: null }, select: { id: true, nom: true } },
    },
  });

  if (!questionnaire) {
    return null;
  }

  const { versions, ...reste } = questionnaire;
  return { ...reste, version: versions[0] ?? null };
}