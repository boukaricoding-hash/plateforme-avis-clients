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
  questionnaire_id: true,
  nom: true,
  type: true,
  zone: true,
  code_public: true,
  actif: true,
  revoque_le: true,
  cree_le: true,
  // Titre du questionnaire associe ({ fr, en }), null si aucun.
  questionnaire: { select: { titre: true } },
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

// Vrai si le questionnaire appartient a CETTE organisation (un modele sectoriel n'a pas
// d'organisation : il faut d'abord le cloner).
export async function questionnaireExisteDansOrganisation(
  organisationId: string,
  questionnaireId: string,
): Promise<boolean> {
  const questionnaire = await prisma.questionnaire.findFirst({
    where: { id: questionnaireId, organisation_id: organisationId, supprime_le: null },
    select: { id: true },
  });
  return questionnaire !== null;
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

async function lirePointContact(organisationId: string, pointContactId: string) {
  return prisma.pointContact.findFirst({
    where: { id: pointContactId, organisation_id: organisationId, supprime_le: null },
    select: CHAMPS_POINT_CONTACT,
  });
}

type PointContactComplet = NonNullable<Awaited<ReturnType<typeof lirePointContact>>>;

export type ResultatCreationPoint =
  | { etat: "ok"; point_contact: PointContactComplet }
  | { etat: "site_introuvable" }
  | { etat: "questionnaire_invalide" };

export type ResultatCreationMasse =
  | { etat: "ok"; crees: number; deja_existants: number }
  | { etat: "site_introuvable" }
  | { etat: "questionnaire_invalide" };

export type ResultatModificationPoint =
  | { etat: "ok"; point_contact: PointContactComplet }
  | { etat: "introuvable" }
  | { etat: "questionnaire_invalide" };

export async function creerPointContact(
  organisationId: string,
  donnees: DonneesCreationPointContact,
): Promise<ResultatCreationPoint> {
  if (!(await siteExisteDansOrganisation(organisationId, donnees.site_id))) {
    return { etat: "site_introuvable" };
  }
  if (
    donnees.questionnaire_id !== undefined &&
    !(await questionnaireExisteDansOrganisation(organisationId, donnees.questionnaire_id))
  ) {
    return { etat: "questionnaire_invalide" };
  }

  const point = await prisma.pointContact.create({
    data: {
      organisation_id: organisationId,
      site_id: donnees.site_id,
      nom: donnees.nom,
      type: donnees.type,
      code_public: genererCodePublic(),
      ...(donnees.zone !== undefined ? { zone: donnees.zone } : {}),
      ...(donnees.questionnaire_id !== undefined
        ? { questionnaire_id: donnees.questionnaire_id }
        : {}),
    },
    select: CHAMPS_POINT_CONTACT,
  });
  return { etat: "ok", point_contact: point };
}

// Cree "<prefixe> <debut>" a "<prefixe> <fin>". Les noms deja existants dans le site sont ignores
// (ils gardent leur questionnaire). Le questionnaire choisi s'applique a tous les points crees.
export async function creerPointsContactEnMasse(
  organisationId: string,
  donnees: DonneesCreationMasse,
): Promise<ResultatCreationMasse> {
  if (!(await siteExisteDansOrganisation(organisationId, donnees.site_id))) {
    return { etat: "site_introuvable" };
  }
  if (
    donnees.questionnaire_id !== undefined &&
    !(await questionnaireExisteDansOrganisation(organisationId, donnees.questionnaire_id))
  ) {
    return { etat: "questionnaire_invalide" };
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
        ...(donnees.questionnaire_id !== undefined
          ? { questionnaire_id: donnees.questionnaire_id }
          : {}),
      })),
    });
  }

  return {
    etat: "ok",
    crees: nomsACreer.length,
    deja_existants: noms.length - nomsACreer.length,
  };
}

// questionnaire_id : absent = inchange, null = retire, identifiant = associe (si c'est le
// questionnaire de CETTE organisation).
export async function modifierPointContact(
  organisationId: string,
  pointContactId: string,
  donnees: DonneesModificationPointContact,
): Promise<ResultatModificationPoint> {
  if (
    donnees.questionnaire_id !== undefined &&
    donnees.questionnaire_id !== null &&
    !(await questionnaireExisteDansOrganisation(organisationId, donnees.questionnaire_id))
  ) {
    return { etat: "questionnaire_invalide" };
  }

  const resultat = await prisma.pointContact.updateMany({
    where: { id: pointContactId, organisation_id: organisationId, supprime_le: null },
    data: {
      ...(donnees.nom !== undefined ? { nom: donnees.nom } : {}),
      ...(donnees.type !== undefined ? { type: donnees.type } : {}),
      ...(donnees.zone !== undefined ? { zone: donnees.zone } : {}),
      ...(donnees.questionnaire_id !== undefined
        ? { questionnaire_id: donnees.questionnaire_id }
        : {}),
    },
  });
  if (resultat.count === 0) {
    return { etat: "introuvable" };
  }

  const point = await lirePointContact(organisationId, pointContactId);
  return point ? { etat: "ok", point_contact: point } : { etat: "introuvable" };
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

// Reactiver remet seulement "actif" a vrai. Un QR code revoque le reste : pour qu'il
// refonctionne, il faut le regenerer (nouveau code).
export async function activerPointContact(organisationId: string, pointContactId: string) {
  const resultat = await prisma.pointContact.updateMany({
    where: { id: pointContactId, organisation_id: organisationId, supprime_le: null },
    data: { actif: true },
  });
  if (resultat.count === 0) {
    return null;
  }
  return lirePointContact(organisationId, pointContactId);
}