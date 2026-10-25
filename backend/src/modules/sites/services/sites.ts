import { prisma } from "../../../configuration/base-de-donnees";
import type { DonneesCreationSite, DonneesModificationSite } from "../validations/site";
// Les champs renvoyes au navigateur (pas de supprime_le, pas d'organisation_id).
export const CHAMPS_SITE = {
  id: true,
  nom: true,
  adresse: true,
  ville: true,
  telephone: true,
  actif: true,
  cree_le: true,
} as const;

// sitesAutorises : null = toute l'organisation, sinon la liste des sites du Gestionnaire.
export async function listerSites(organisationId: string, sitesAutorises: string[] | null) {
  return prisma.site.findMany({
    where: {
      organisation_id: organisationId,
      supprime_le: null,
      ...(sitesAutorises !== null ? { id: { in: sitesAutorises } } : {}),
    },
    select: CHAMPS_SITE,
    orderBy: { nom: "asc" },
  });
}

export async function creerSite(organisationId: string, donnees: DonneesCreationSite) {
  return prisma.site.create({
    data: {
      organisation_id: organisationId,
      nom: donnees.nom,
      ...(donnees.adresse !== undefined ? { adresse: donnees.adresse } : {}),
      ...(donnees.ville !== undefined ? { ville: donnees.ville } : {}),
      ...(donnees.telephone !== undefined ? { telephone: donnees.telephone } : {}),
    },
    select: CHAMPS_SITE,
  });
}
async function lireSite(organisationId: string, siteId: string) {
  return prisma.site.findFirst({
    where: { id: siteId, organisation_id: organisationId, supprime_le: null },
    select: CHAMPS_SITE,
  });
}

// Renvoie null si le site n'existe pas dans CETTE organisation.
export async function modifierSite(
  organisationId: string,
  siteId: string,
  donnees: DonneesModificationSite,
) {
  const resultat = await prisma.site.updateMany({
    where: { id: siteId, organisation_id: organisationId, supprime_le: null },
    data: {
      ...(donnees.nom !== undefined ? { nom: donnees.nom } : {}),
      ...(donnees.adresse !== undefined ? { adresse: donnees.adresse } : {}),
      ...(donnees.ville !== undefined ? { ville: donnees.ville } : {}),
      ...(donnees.telephone !== undefined ? { telephone: donnees.telephone } : {}),
    },
  });
  if (resultat.count === 0) {
    return null;
  }
  return lireSite(organisationId, siteId);
}

// Desactiver ne supprime rien : les avis restent lies au site.
export async function desactiverSite(organisationId: string, siteId: string) {
  const resultat = await prisma.site.updateMany({
    where: { id: siteId, organisation_id: organisationId, supprime_le: null },
    data: { actif: false },
  });
  if (resultat.count === 0) {
    return null;
  }
  return lireSite(organisationId, siteId);
}