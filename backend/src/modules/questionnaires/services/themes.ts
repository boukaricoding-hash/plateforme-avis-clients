import { prisma } from "../../../configuration/base-de-donnees";

// Themes du secteur de l'organisation (jour 19) : proposes dans l'editeur de questionnaire
// pour rattacher chaque question a un theme (service, proprete, rapidite...).
// Un questionnaire ne peut utiliser que les themes du secteur de SON organisation :
// la meme regle est verifiee a l'enregistrement par themesValides (services/questionnaires.ts).
// L'organisation vient toujours de la session, jamais du navigateur.
export async function listerThemesDuSecteur(organisationId: string) {
  const organisation = await prisma.organisation.findUniqueOrThrow({
    where: { id: organisationId },
    select: { secteur_id: true },
  });

  return prisma.theme.findMany({
    where: { secteur_id: organisation.secteur_id },
    select: { id: true, code: true, libelle_fr: true, libelle_en: true },
    orderBy: [{ ordre: "asc" }, { code: "asc" }],
  });
}