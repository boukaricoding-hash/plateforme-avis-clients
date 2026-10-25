import { prisma } from "../../../configuration/base-de-donnees";

export type ResultatAssociation =
  | {
      etat: "ok";
      points_contact: { id: string; nom: string; type: string; site_id: string }[];
    }
  | { etat: "introuvable" }
  | { etat: "points_invalides" };

// Remplace la liste des points de contact associes au questionnaire.
// - introuvable : le questionnaire n'est pas dans CETTE organisation.
// - points_invalides : un point de contact n'existe pas dans CETTE organisation.
export async function associerPointsContact(
  organisationId: string,
  questionnaireId: string,
  pointsContactIds: string[],
): Promise<ResultatAssociation> {
  return prisma.$transaction(async (tx) => {
    const questionnaire = await tx.questionnaire.findFirst({
      where: { id: questionnaireId, organisation_id: organisationId, supprime_le: null },
      select: { id: true },
    });
    if (!questionnaire) {
      return { etat: "introuvable" };
    }

    const nombre = await tx.pointContact.count({
      where: { id: { in: pointsContactIds }, organisation_id: organisationId, supprime_le: null },
    });
    if (nombre !== pointsContactIds.length) {
      return { etat: "points_invalides" };
    }

    // Detache les points qui ne sont plus dans la liste.
    await tx.pointContact.updateMany({
      where: {
        questionnaire_id: questionnaire.id,
        organisation_id: organisationId,
        id: { notIn: pointsContactIds },
      },
      data: { questionnaire_id: null },
    });

    // Associe les points de la liste (meme s'ils avaient un autre questionnaire).
    await tx.pointContact.updateMany({
      where: { id: { in: pointsContactIds }, organisation_id: organisationId },
      data: { questionnaire_id: questionnaire.id },
    });

    const points = await tx.pointContact.findMany({
      where: { questionnaire_id: questionnaire.id, organisation_id: organisationId, supprime_le: null },
      select: { id: true, nom: true, type: true, site_id: true },
      orderBy: { nom: "asc" },
    });
    return { etat: "ok", points_contact: points };
  });
}