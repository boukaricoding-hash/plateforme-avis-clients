import { prisma } from "../../../configuration/base-de-donnees";

export type ResultatSuppression =
  | { etat: "ok"; id: string; points_contact_detaches: number }
  | { etat: "introuvable" }
  | { etat: "a_des_avis"; nombre_avis: number };

// Supprime un questionnaire de CETTE organisation (suppression douce : supprime_le).
// - introuvable : le questionnaire n'est pas dans CETTE organisation (ou deja supprime).
// - a_des_avis : au moins un avis a ete recu, on garde tout (il faut le desactiver a la place).
// Sans avis, ses points de contact sont detaches : leurs QR codes ne pointent plus vers rien.
export async function supprimerQuestionnaire(
  organisationId: string,
  questionnaireId: string,
): Promise<ResultatSuppression> {
  return prisma.$transaction(async (tx) => {
    const questionnaire = await tx.questionnaire.findFirst({
      where: { id: questionnaireId, organisation_id: organisationId, supprime_le: null },
      select: { id: true },
    });
    if (!questionnaire) {
      return { etat: "introuvable" };
    }

    const nombreAvis = await tx.avis.count({
      where: { version: { questionnaire_id: questionnaire.id }, supprime_le: null },
    });
    if (nombreAvis > 0) {
      return { etat: "a_des_avis", nombre_avis: nombreAvis };
    }

    // Seuls les points visibles sont comptes pour le message ; tous sont detaches.
    const pointsContactDetaches = await tx.pointContact.count({
      where: { questionnaire_id: questionnaire.id, organisation_id: organisationId, supprime_le: null },
    });
    await tx.pointContact.updateMany({
      where: { questionnaire_id: questionnaire.id, organisation_id: organisationId },
      data: { questionnaire_id: null },
    });

    await tx.questionnaire.update({
      where: { id: questionnaire.id },
      data: { supprime_le: new Date() },
    });

    return { etat: "ok", id: questionnaire.id, points_contact_detaches: pointsContactDetaches };
  });
}