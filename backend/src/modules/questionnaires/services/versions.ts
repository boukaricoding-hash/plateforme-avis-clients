import { prisma } from "../../../configuration/base-de-donnees";

// Une ligne de l'historique : une version du questionnaire.
export type VersionHistorique = {
  id: string;
  numero: number;
  // null = version pas encore publiee.
  publie_le: Date | null;
  cree_le: Date;
  nombre_questions: number;
  // Avis recus avec CETTE version (avis supprimes non comptes).
  nombre_avis: number;
};

// Historique des versions d'un questionnaire, de la plus recente a la plus ancienne.
// Renvoie null si le questionnaire n'existe pas dans CETTE organisation.
export async function listerVersionsQuestionnaire(
  organisationId: string,
  questionnaireId: string,
): Promise<VersionHistorique[] | null> {
  const questionnaire = await prisma.questionnaire.findFirst({
    where: { id: questionnaireId, organisation_id: organisationId, supprime_le: null },
    select: {
      versions: {
        orderBy: { numero: "desc" },
        select: {
          id: true,
          numero: true,
          publie_le: true,
          cree_le: true,
          _count: {
            select: {
              questions: true,
              avis: { where: { supprime_le: null } },
            },
          },
        },
      },
    },
  });

  if (!questionnaire) {
    return null;
  }

  return questionnaire.versions.map(({ _count, ...version }) => ({
    ...version,
    nombre_questions: _count.questions,
    nombre_avis: _count.avis,
  }));
}