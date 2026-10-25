import { randomBytes } from "node:crypto";
import { prisma } from "../../../configuration/base-de-donnees";
import type {
  DonneesCreationMasse,
  DonneesCreationPointContact,
  DonneesModificationPointContact,
} from "../validations/point-contact";

export const CHAMPS_POINT_CONTACT = {
  id: true,
  site_id: true,
  nom: true,
  type: true,
  zone: true,
  code_public: true,
  actif: true,
  revoque_le: true,
  cree_le: true,
} as const;

// 12 caracteres aleatoires, utilisables dans une adresse web.
export function genererCodePublic(): string {
  return randomBytes(9).toString("base64url");
}

// Vrai si le site existe dans CETTE organisation.
export async function siteExisteDansOrganisation(
  organisationId: string,
  siteId: string,
): Promise<boolean> {
  const site = await prisma.site.findFirst({
    where: { id: siteId, organisation_id: organisationId, supprime_le: null },
    select: { id: true },
  });
  return site !== null;
}

// perimetre : null = toute l'organisation, sinon la liste des sites du Gestionnaire.
export async function listerPointsContact(
  organisationId: string,
  perimetre: string[] | null,
  siteId: string | undefined,
) {
  let filtreSite: { site_id?: string | { in: string[] } } = {};
  if (perimetre !== null) {
    const ids = siteId !== undefined ? perimetre.filter((id) => id === siteId) : perimetre;
    filtreSite = { site_id: { in: ids } };
  } else if (siteId !== undefined) {
    filtreSite = { site_id: siteId };
  }

  return prisma.pointContact.findMany({
    where: { organisation_id: organisationId, supprime_le: null, ...filtreSite },
    select: CHAMPS_POINT_CONTACT,
    orderBy: [{ site_id: "asc" }, { nom: "asc" }],
  });
}

// Renvoie null si le site n'existe pas dans cette organisation.
export async function creerPointContact(
  organisationId: string,
  donnees: DonneesCreationPointContact,
) {
  if (!(await siteExisteDansOrganisation(organisationId, donnees.site_id))) {
    return null;
  }

  return prisma.pointContact.create({
    data: {
      organisation_id: organisationId,
      site_id: donnees.site_id,
      nom: donnees.nom,
      type: donnees.type,
      code_public: genererCodePublic(),
      ...(donnees.zone !== undefined ? { zone: donnees.zone } : {}),
    },
    select: CHAMPS_POINT_CONTACT,
  });
}

// Cree "<prefixe> <debut>" a "<prefixe> <fin>". Les noms deja existants dans le site sont ignores.
// Renvoie null si le site n'existe pas dans cette organisation.
export async function creerPointsContactEnMasse(
  organisationId: string,
  donnees: DonneesCreationMasse,
) {
  if (!(await siteExisteDansOrganisation(organisationId, donnees.site_id))) {
    return null;
  }

  const noms: string[] = [];
  for (let numero = donnees.debut; numero <= donnees.fin; numero++) {
    noms.push(donnees.prefixe + " " + numero);
  }

  const existants = await prisma.pointContact.findMany({
    where: { site_id: donnees.site_id, supprime_le: null, nom: { in: noms } },
    select: { nom: true },
  });
  const nomsExistants = new Set(existants.map((point) => point.nom));
  const nomsACreer = noms.filter((nom) => !nomsExistants.has(nom));

  if (nomsACreer.length > 0) {
    await prisma.pointContact.createMany({
      data: nomsACreer.map((nom) => ({
        organisation_id: organisationId,
        site_id: donnees.site_id,
        nom,
        type: donnees.type,
        code_public: genererCodePublic(),
      })),
    });
  }

  return { crees: nomsACreer.length, deja_existants: noms.length - nomsACreer.length };
}

async function lirePointContact(organisationId: string, pointContactId: string) {
  return prisma.pointContact.findFirst({
    where: { id: pointContactId, organisation_id: organisationId, supprime_le: null },
    select: CHAMPS_POINT_CONTACT,
  });
}

// Renvoie null si le point de contact n'existe pas dans CETTE organisation.
export async function modifierPointContact(
  organisationId: string,
  pointContactId: string,
  donnees: DonneesModificationPointContact,
) {
  const resultat = await prisma.pointContact.updateMany({
    where: { id: pointContactId, organisation_id: organisationId, supprime_le: null },
    data: {
      ...(donnees.nom !== undefined ? { nom: donnees.nom } : {}),
      ...(donnees.type !== undefined ? { type: donnees.type } : {}),
      ...(donnees.zone !== undefined ? { zone: donnees.zone } : {}),
    },
  });
  if (resultat.count === 0) {
    return null;
  }
  return lirePointContact(organisationId, pointContactId);
}

// Desactiver ne supprime rien : les avis restent lies au point de contact.
export async function desactiverPointContact(organisationId: string, pointContactId: string) {
  const resultat = await prisma.pointContact.updateMany({
    where: { id: pointContactId, organisation_id: organisationId, supprime_le: null },
    data: { actif: false },
  });
  if (resultat.count === 0) {
    return null;
  }
  return lirePointContact(organisationId, pointContactId);
}