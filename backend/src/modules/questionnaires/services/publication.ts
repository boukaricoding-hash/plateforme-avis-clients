import { Prisma } from "../../../../generated/prisma/client";
import { prisma } from "../../../configuration/base-de-donnees";

// Valeur JSON nullable : null devient Prisma.DbNull, sinon on garde la valeur.
function jsonOuNull(valeur: Prisma.JsonValue | null): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return valeur === null ? Prisma.DbNull : (valeur as Prisma.InputJsonValue);
}

// Publie la derniere version et active le questionnaire.
// Renvoie null si le questionnaire n'existe pas dans CETTE organisation.
export async function publierQuestionnaire(organisationId: string, questionnaireId: string) {
  return prisma.$transaction(async (tx) => {
    const existant = await tx.questionnaire.findFirst({
      where: { id: questionnaireId, organisation_id: organisationId, supprime_le: null },
      select: {
        id: true,
        versions: {
          orderBy: { numero: "desc" },
          take: 1,
          select: { id: true, numero: true, publie_le: true },
        },
      },
    });
    const derniere = existant?.versions[0];
    if (!existant || !derniere) {
      return null;
    }

    const publieLe = derniere.publie_le ?? new Date();
    if (!derniere.publie_le) {
      await tx.questionnaireVersion.update({
        where: { id: derniere.id },
        data: { publie_le: publieLe },
      });
    }

    const questionnaire = await tx.questionnaire.update({
      where: { id: existant.id },
      data: { statut: "ACTIF" },
      select: { id: true, statut: true },
    });

    return {
      id: questionnaire.id,
      statut: questionnaire.statut,
      version: derniere.numero,
      publie_le: publieLe,
    };
  });
}

// Copie un questionnaire (derniere version) en nouveau brouillon, version 1.
// Les points de contact et les dates ne sont pas copies.
// Renvoie null si le questionnaire n'existe pas dans CETTE organisation.
export async function dupliquerQuestionnaire(
  organisationId: string,
  questionnaireId: string,
): Promise<string | null> {
  return prisma.$transaction(async (tx) => {
    const source = await tx.questionnaire.findFirst({
      where: { id: questionnaireId, organisation_id: organisationId, supprime_le: null },
      select: {
        titre: true,
        message_accueil: true,
        message_remerciement: true,
        langue_defaut: true,
        versions: {
          orderBy: { numero: "desc" },
          take: 1,
          select: {
            questions: {
              orderBy: { ordre: "asc" },
              select: {
                ordre: true,
                type: true,
                libelle: true,
                aide: true,
                obligatoire: true,
                theme_id: true,
                options: true,
                echelle_min: true,
                echelle_max: true,
                libelles_extremites: true,
                condition: true,
              },
            },
          },
        },
      },
    });
    const derniere = source?.versions[0];
    if (!source || !derniere) {
      return null;
    }

    const titreSource = source.titre as { fr: string; en?: string };
    const titre = {
      fr: `${titreSource.fr.slice(0, 480)} (copie)`,
      ...(titreSource.en ? { en: `${titreSource.en.slice(0, 480)} (copy)` } : {}),
    };

    const copie = await tx.questionnaire.create({
      data: {
        organisation_id: organisationId,
        titre,
        langue_defaut: source.langue_defaut,
        message_accueil: jsonOuNull(source.message_accueil),
        message_remerciement: jsonOuNull(source.message_remerciement),
      },
      select: { id: true },
    });

    const version = await tx.questionnaireVersion.create({
      data: { questionnaire_id: copie.id, numero: 1 },
      select: { id: true },
    });

    await tx.question.createMany({
      data: derniere.questions.map((question) => ({
        version_id: version.id,
        ordre: question.ordre,
        type: question.type,
        libelle: question.libelle as Prisma.InputJsonValue,
        obligatoire: question.obligatoire,
        theme_id: question.theme_id,
        echelle_min: question.echelle_min,
        echelle_max: question.echelle_max,
        aide: jsonOuNull(question.aide),
        options: jsonOuNull(question.options),
        libelles_extremites: jsonOuNull(question.libelles_extremites),
        condition: jsonOuNull(question.condition),
      })),
    });

    return copie.id;
  });
}