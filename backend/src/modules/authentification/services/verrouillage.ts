import { prisma } from "../../../configuration/base-de-donnees";

const ECHECS_MAX = 5;
const VERROUILLAGE_MINUTES = 15;

export function estVerrouille(verrouilleJusqua: Date | null): boolean {
  return verrouilleJusqua !== null && verrouilleJusqua > new Date();
}

// Ajoute 1 echec. Au 5e echec, verrouille le compte 15 minutes
// et remet le compteur a zero. Renvoie true si le compte vient d'etre verrouille.
export async function enregistrerEchec(utilisateurId: string): Promise<boolean> {
  const utilisateur = await prisma.utilisateur.update({
    where: { id: utilisateurId },
    data: { tentatives_echec: { increment: 1 } },
    select: { tentatives_echec: true },
  });

  if (utilisateur.tentatives_echec < ECHECS_MAX) {
    return false;
  }

  await prisma.utilisateur.update({
    where: { id: utilisateurId },
    data: {
      tentatives_echec: 0,
      verrouille_jusqua: new Date(Date.now() + VERROUILLAGE_MINUTES * 60 * 1000),
    },
  });
  return true;
}