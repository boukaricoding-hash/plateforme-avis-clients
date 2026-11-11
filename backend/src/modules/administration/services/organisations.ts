import { prisma } from "../../../configuration/base-de-donnees";
import { enregistrerAudit } from "../../journal-audit/services/journal";
import { clonerModele } from "../../questionnaires/services/modeles";
import type {
  DonneesCreationOrganisation,
  DonneesModificationOrganisation,
  FiltresOrganisations,
} from "../validations/organisations";

// Les champs renvoyes au navigateur : jamais supprime_le ni les seuils internes.
// Le secteur est renvoye avec son code et ses deux noms pour l'ecran de liste.
export const CHAMPS_ORGANISATION = {
  id: true,
  nom: true,
  logo_url: true,
  couleur_principale: true,
  pays: true,
  fuseau_horaire: true,
  langue_defaut: true,
  statut: true,
  cree_le: true,
  modifie_le: true,
  secteur: { select: { id: true, code: true, nom_fr: true, nom_en: true } },
} as const;

// Les actions sont faites par un administrateur DTS : on garde qui, ou (IP) et sur quelle organisation.
type Acteur = { utilisateurId: string; ip: string | undefined };

// ------------------------------------------------------------
// Lecture
// ------------------------------------------------------------

// Renvoie null si l'organisation n'existe pas ou a ete supprimee.
export async function lireOrganisation(organisationId: string) {
  return prisma.organisation.findFirst({
    where: { id: organisationId, supprime_le: null },
    select: CHAMPS_ORGANISATION,
  });
}

// Liste paginee, la plus recente d'abord. Les filtres sont tous facultatifs.
export async function listerOrganisations(filtres: FiltresOrganisations) {
  const where = {
    supprime_le: null,
    ...(filtres.statut !== undefined ? { statut: filtres.statut } : {}),
    ...(filtres.secteur !== undefined ? { secteur_id: filtres.secteur } : {}),
    ...(filtres.q !== undefined
      ? { nom: { contains: filtres.q, mode: "insensitive" as const } }
      : {}),
  };

  const [organisations, total] = await Promise.all([
    prisma.organisation.findMany({
      where,
      select: CHAMPS_ORGANISATION,
      orderBy: { cree_le: "desc" },
      skip: (filtres.page - 1) * filtres.limite,
      take: filtres.limite,
    }),
    prisma.organisation.count({ where }),
  ]);

  return {
    organisations,
    pagination: {
      page: filtres.page,
      limite: filtres.limite,
      total,
      pages: Math.ceil(total / filtres.limite),
    },
  };
}

// ------------------------------------------------------------
// Creation
// ------------------------------------------------------------

export type ResultatCreation =
  | {
      etat: "ok";
      organisation: NonNullable<Awaited<ReturnType<typeof lireOrganisation>>>;
      // Brouillon clone depuis le modele du secteur, ou null s'il n'y en a pas (ou si la copie a echoue).
      questionnaire_id: string | null;
    }
  | { etat: "secteur_invalide" };

// Copie le premier modele du secteur dans la nouvelle organisation (en brouillon).
// Si la copie echoue, l'organisation reste creee : l'administrateur peut cloner a la main.
async function clonerModeleDuSecteur(
  organisationId: string,
  secteurId: string,
): Promise<string | null> {
  try {
    const modele = await prisma.questionnaire.findFirst({
      where: { est_modele: true, secteur_id: secteurId, supprime_le: null },
      orderBy: { cree_le: "asc" },
      select: { id: true },
    });
    if (!modele) {
      return null;
    }
    return await clonerModele(organisationId, modele.id);
  } catch (erreur) {
    console.error("Creation d'organisation : clonage du modele impossible", erreur);
    return null;
  }
}

// Cree l'organisation puis clone le modele de son secteur.
// Le secteur doit exister et etre actif. Le logo n'est pas envoye ici (ecran E14).
export async function creerOrganisation(
  acteur: Acteur,
  donnees: DonneesCreationOrganisation,
): Promise<ResultatCreation> {
  const secteur = await prisma.secteur.findFirst({
    where: { id: donnees.secteur_id, actif: true },
    select: { id: true, code: true },
  });
  if (!secteur) {
    return { etat: "secteur_invalide" };
  }

  const creee = await prisma.organisation.create({
    data: {
      nom: donnees.nom,
      secteur_id: secteur.id,
      couleur_principale: donnees.couleur_principale,
      pays: donnees.pays,
      fuseau_horaire: donnees.fuseau_horaire,
      langue_defaut: donnees.langue_defaut,
      statut: donnees.statut,
    },
    select: { id: true },
  });

  const questionnaireId = await clonerModeleDuSecteur(creee.id, secteur.id);

  await enregistrerAudit({
    action: "ORGANISATION_CREEE",
    utilisateurId: acteur.utilisateurId,
    organisationId: creee.id,
    ip: acteur.ip,
    details: {
      nom: donnees.nom,
      secteur: secteur.code,
      statut: donnees.statut,
      modele_clone: questionnaireId !== null,
    },
  });

  const organisation = await lireOrganisation(creee.id);
  if (!organisation) {
    // Ne devrait jamais arriver : l'organisation vient d'etre creee.
    throw new Error("Organisation introuvable juste apres sa creation.");
  }
  return { etat: "ok", organisation, questionnaire_id: questionnaireId };
}

// ------------------------------------------------------------
// Modification
// ------------------------------------------------------------

// Seuls les champs envoyes changent. Renvoie null si l'organisation n'existe pas.
// Le secteur et le statut ne passent jamais ici.
export async function modifierOrganisation(
  acteur: Acteur,
  organisationId: string,
  donnees: DonneesModificationOrganisation,
) {
  const existante = await lireOrganisation(organisationId);
  if (!existante) {
    return null;
  }

  const modifications = {
    ...(donnees.nom !== undefined ? { nom: donnees.nom } : {}),
    ...(donnees.couleur_principale !== undefined
      ? { couleur_principale: donnees.couleur_principale }
      : {}),
    ...(donnees.pays !== undefined ? { pays: donnees.pays } : {}),
    ...(donnees.fuseau_horaire !== undefined ? { fuseau_horaire: donnees.fuseau_horaire } : {}),
    ...(donnees.langue_defaut !== undefined ? { langue_defaut: donnees.langue_defaut } : {}),
  };

  const organisation = await prisma.organisation.update({
    where: { id: organisationId },
    data: modifications,
    select: CHAMPS_ORGANISATION,
  });

  await enregistrerAudit({
    action: "ORGANISATION_MODIFIEE",
    utilisateurId: acteur.utilisateurId,
    organisationId,
    ip: acteur.ip,
    details: modifications,
  });

  return organisation;
}

// ------------------------------------------------------------
// Suspension et reactivation
// ------------------------------------------------------------

export type ResultatChangementStatut =
  | { etat: "ok"; organisation: NonNullable<Awaited<ReturnType<typeof lireOrganisation>>> }
  | { etat: "introuvable" }
  // Suspendre une organisation deja suspendue, ou reactiver une organisation qui ne l'est pas.
  | { etat: "deja_dans_cet_etat" };

// La connexion et les sessions d'une organisation suspendue sont refusees ailleurs
// (authentification) : ici on change seulement le statut et on ecrit le journal.
export async function suspendreOrganisation(
  acteur: Acteur,
  organisationId: string,
): Promise<ResultatChangementStatut> {
  const existante = await lireOrganisation(organisationId);
  if (!existante) {
    return { etat: "introuvable" };
  }
  if (existante.statut === "SUSPENDU") {
    return { etat: "deja_dans_cet_etat" };
  }

  const organisation = await prisma.organisation.update({
    where: { id: organisationId },
    data: { statut: "SUSPENDU" },
    select: CHAMPS_ORGANISATION,
  });

  await enregistrerAudit({
    action: "ORGANISATION_SUSPENDUE",
    utilisateurId: acteur.utilisateurId,
    organisationId,
    ip: acteur.ip,
    details: { statut_precedent: existante.statut },
  });

  return { etat: "ok", organisation };
}

// La base ne garde pas l'ancien statut : une organisation reactivee repasse a ACTIF.
export async function reactiverOrganisation(
  acteur: Acteur,
  organisationId: string,
): Promise<ResultatChangementStatut> {
  const existante = await lireOrganisation(organisationId);
  if (!existante) {
    return { etat: "introuvable" };
  }
  if (existante.statut !== "SUSPENDU") {
    return { etat: "deja_dans_cet_etat" };
  }

  const organisation = await prisma.organisation.update({
    where: { id: organisationId },
    data: { statut: "ACTIF" },
    select: CHAMPS_ORGANISATION,
  });

  await enregistrerAudit({
    action: "ORGANISATION_REACTIVEE",
    utilisateurId: acteur.utilisateurId,
    organisationId,
    ip: acteur.ip,
    details: { statut_precedent: existante.statut },
  });

  return { etat: "ok", organisation };
}