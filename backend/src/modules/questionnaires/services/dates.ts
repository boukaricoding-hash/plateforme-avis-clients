import { prisma } from "../../../configuration/base-de-donnees";
import type { DonneesDates } from "../validations/dates";

// Remplace les dates de debut et de fin (null = pas de date).
// Renvoie null si le questionnaire n'existe pas dans CETTE organisation.
export async function modifierDatesQuestionnaire(
  organisationId: string,
  questionnaireId: string,
  dates: DonneesDates,
) {
  const existant = await prisma.questionnaire.findFirst({
    where: { id: questionnaireId, organisation_id: organisationId, supprime_le: null },
    select: { id: true },
  });
  if (!existant) {
    return null;
  }

  return prisma.questionnaire.update({
    where: { id: existant.id },
    data: {
      date_debut: dates.date_debut === null ? null : new Date(dates.date_debut),
      date_fin: dates.date_fin === null ? null : new Date(dates.date_fin),
    },
    select: { id: true, statut: true, date_debut: true, date_fin: true },
  });
}