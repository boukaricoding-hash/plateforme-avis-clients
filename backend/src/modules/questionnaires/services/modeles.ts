import { Prisma } from "../../../../generated/prisma/client";
import { prisma } from "../../../configuration/base-de-donnees";

// Valeur JSON nullable : null devient Prisma.DbNull, sinon on garde la valeur.
function jsonOuNull(valeur: Prisma.JsonValue | null): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return valeur === null ? Prisma.DbNull : (valeur as Prisma.InputJsonValue);
}

// Modeles du secteur de l'organisation (ceux des autres secteurs ne sont pas proposes).
export async function listerModeles(organisationId: string) {
  const organisation = await prisma.organisation.findUniqueOrThrow({
    where: { id: organisationId },
    select: { secteur_id: true },
  });

  const modeles = await prisma.questionnaire.findMany({
    where: { est_modele: true, secteur_id: organisation.secteur_id, supprime_le: null },
    select: {
      id: true,
      titre: true,
      message_accueil: true,
      langue_defaut: true,
      versions: {
        orderBy: { numero: "desc" },
        take: 1,
        select: { numero: true, _count: { select: { questions: true } } },
      },
    },
    orderBy: { cree_le: "asc" },
  });

  return modeles.map(({ versions, ...modele }) => ({
    ...modele,
    nombre_questions: versions[0]?._count.questions ?? 0,
  }));
}

// Copie un modele du secteur de l'organisation en nouveau brouillon (version 1).
// Renvoie null si le modele n'existe pas ou n'est pas du secteur de l'organisation.
export async function clonerModele(
  organisationId: string,
  modeleId: string,
): Promise<string | null> {
  return prisma.$transaction(async (tx) => {
    const organisation = await tx.organisation.findUniqueOrThrow({
      where: { id: organisationId },
      select: { secteur_id: true },
    });

    const modele = await tx.questionnaire.findFirst({
      where: {
        id: modeleId,
        est_modele: true,
        secteur_id: organisation.secteur_id,
        supprime_le: null,
      },
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
    const derniere = modele?.versions[0];
    if (!modele || !derniere) {
      return null;
    }

    const copie = await tx.questionnaire.create({
      data: {
        organisation_id: organisationId,
        titre: modele.titre as Prisma.InputJsonValue,
        langue_defaut: modele.langue_defaut,
        message_accueil: jsonOuNull(modele.message_accueil),
        message_remerciement: jsonOuNull(modele.message_remerciement),
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