import { prisma } from "../../../configuration/base-de-donnees";

export type ResultatStatut =
  | { etat: "ok"; id: string; statut: "ACTIF" | "INACTIF" }
  | { etat: "introuvable" }
  | { etat: "non_publie" };

// Cherche le questionnaire dans CETTE organisation, avec la date de publication de sa derniere version.
async function trouverQuestionnaire(organisationId: string, questionnaireId: string) {
  return prisma.questionnaire.findFirst({
    where: { id: questionnaireId, organisation_id: organisationId, supprime_le: null },
    select: {
      id: true,
      versions: {
        orderBy: { numero: "desc" },
        take: 1,
        select: { publie_le: true },
      },
    },
  });
}

// Reactive un questionnaire. Il faut que sa derniere version ait deja ete publiee.
export async function activerQuestionnaire(
  organisationId: string,
  questionnaireId: string,
): Promise<ResultatStatut> {
  const questionnaire = await trouverQuestionnaire(organisationId, questionnaireId);
  if (!questionnaire) {
    return { etat: "introuvable" };
  }
  if (!questionnaire.versions[0]?.publie_le) {
    return { etat: "non_publie" };
  }

  await prisma.questionnaire.update({
    where: { id: questionnaire.id },
    data: { statut: "ACTIF" },
  });
  return { etat: "ok", id: questionnaire.id, statut: "ACTIF" };
}

// Desactive un questionnaire : ses avis et ses versions sont conserves.
export async function desactiverQuestionnaire(
  organisationId: string,
  questionnaireId: string,
): Promise<ResultatStatut> {
  const questionnaire = await trouverQuestionnaire(organisationId, questionnaireId);
  if (!questionnaire) {
    return { etat: "introuvable" };
  }

  await prisma.questionnaire.update({
    where: { id: questionnaire.id },
    data: { statut: "INACTIF" },
  });
  return { etat: "ok", id: questionnaire.id, statut: "INACTIF" };
}