import { randomBytes } from "node:crypto";
import { prisma } from "../../../configuration/base-de-donnees";
import { echapperHtml, envoyerEmail } from "../../../utilitaires/envoi-email";
import { empreinteJeton } from "../../authentification/services/sessions";
import type { DonneesInvitation } from "../validations/utilisateurs";

// Un invite n'ouvre pas toujours son e-mail tout de suite : 7 jours, a usage unique.
export const DUREE_VALIDITE_INVITATION_JOURS = 7;

const MS_JOUR = 24 * 60 * 60 * 1000;

type Role = "RESPONSABLE" | "GESTIONNAIRE" | "ADMINISTRATEUR";

// ------------------------------------------------------------
// Lecture des invitations en attente (liste de l'ecran E13)
// ------------------------------------------------------------

export type InvitationEnAttente = {
  id: string;
  email: string;
  role: Role;
  expire_le: Date;
  cree_le: Date;
  invite_par_nom: string | null;
  sites: { id: string; nom: string }[];
};

type LigneInvitation = {
  id: string;
  email: string;
  role: Role;
  site_ids: unknown;
  expire_le: Date;
  cree_le: Date;
  invite_par: { nom: string } | null;
};

// Le champ site_ids est un JSON : on ne garde que les textes.
function lireIdsSites(valeur: unknown): string[] {
  if (!Array.isArray(valeur)) {
    return [];
  }
  return valeur.filter((element): element is string => typeof element === "string");
}

async function chercherInvitations(
  organisationId: string,
  invitationId?: string,
): Promise<InvitationEnAttente[]> {
  const lignes: LigneInvitation[] = await prisma.jetonInvitation.findMany({
    where: {
      organisation_id: organisationId,
      utilise_le: null,
      expire_le: { gt: new Date() },
      ...(invitationId !== undefined ? { id: invitationId } : {}),
    },
    select: {
      id: true,
      email: true,
      role: true,
      site_ids: true,
      expire_le: true,
      cree_le: true,
      invite_par: { select: { nom: true } },
    },
    orderBy: { cree_le: "desc" },
  });

  // Les noms des sites : seulement ceux de CETTE organisation, non supprimes.
  const idsSites = Array.from(new Set(lignes.flatMap((ligne) => lireIdsSites(ligne.site_ids))));
  const sites: { id: string; nom: string }[] =
    idsSites.length > 0
      ? await prisma.site.findMany({
          where: { id: { in: idsSites }, organisation_id: organisationId, supprime_le: null },
          select: { id: true, nom: true },
        })
      : [];
  const sitesParId = new Map(sites.map((site) => [site.id, site]));

  return lignes.map((ligne) => ({
    id: ligne.id,
    email: ligne.email,
    role: ligne.role,
    expire_le: ligne.expire_le,
    cree_le: ligne.cree_le,
    invite_par_nom: ligne.invite_par?.nom ?? null,
    sites: lireIdsSites(ligne.site_ids)
      .map((id) => sitesParId.get(id))
      .filter((site): site is { id: string; nom: string } => site !== undefined)
      .sort((a, b) => a.nom.localeCompare(b.nom, "fr")),
  }));
}

export async function listerInvitationsEnAttente(
  organisationId: string,
): Promise<InvitationEnAttente[]> {
  return chercherInvitations(organisationId);
}

// ------------------------------------------------------------
// Creation d'une invitation et envoi de l'e-mail
// ------------------------------------------------------------

function construireLien(jeton: string): string {
  const base = (process.env["TABLEAU_DE_BORD_URL"] ?? "http://localhost:5174").replace(/\/+$/, "");
  return base + "/invitation?jeton=" + encodeURIComponent(jeton);
}

function libelleRole(role: Role): string {
  return role === "GESTIONNAIRE"
    ? "Gestionnaire (accès aux sites qui vous sont attribués)"
    : "Responsable (accès à toute l'organisation)";
}

function construireEmail(params: {
  organisationNom: string;
  inviteurNom: string | null;
  role: Role;
  lien: string;
}): { sujet: string; texte: string; html: string } {
  const sujet = "Invitation à rejoindre " + params.organisationNom;
  const qui = params.inviteurNom ?? "Un responsable";

  const texte = [
    "Bonjour,",
    "",
    qui + " vous invite à rejoindre " + params.organisationNom + " sur la plateforme d'avis clients.",
    "Votre rôle : " + libelleRole(params.role) + ".",
    "",
    "Cliquez sur ce lien pour choisir votre mot de passe et activer votre compte :",
    params.lien,
    "",
    "Ce lien est valable " + DUREE_VALIDITE_INVITATION_JOURS + " jours et ne peut être utilisé qu'une seule fois.",
    "Si vous n'attendiez pas cette invitation, ignorez simplement ce message.",
  ].join("\n");

  const html = [
    "<p>Bonjour,</p>",
    "<p>" +
      echapperHtml(qui) +
      " vous invite à rejoindre <strong>" +
      echapperHtml(params.organisationNom) +
      "</strong> sur la plateforme d'avis clients.</p>",
    "<p>Votre rôle : " + echapperHtml(libelleRole(params.role)) + ".</p>",
    '<p><a href="' + echapperHtml(params.lien) + '">Choisir mon mot de passe</a></p>',
    "<p>Ce lien est valable " + DUREE_VALIDITE_INVITATION_JOURS + " jours et ne peut être utilisé qu'une seule fois.</p>",
    "<p>Si vous n'attendiez pas cette invitation, ignorez simplement ce message.</p>",
  ].join("\n");

  return { sujet, texte, html };
}

export type ResultatInvitation =
  | { etat: "ok"; invitation: InvitationEnAttente; email_envoye: boolean }
  | { etat: "sites_invalides" }
  | { etat: "deja_membre" }
  | { etat: "compte_desactive" }
  | { etat: "adresse_indisponible" };

// Cree l'invitation et envoie l'e-mail. Regles :
// - les sites doivent appartenir a CETTE organisation ;
// - une adresse deja utilisee est refusee (message neutre si elle appartient a une autre organisation) ;
// - une invitation deja en attente pour la meme adresse est remplacee : l'ancien lien ne marche plus ;
// - on attend la reponse du serveur d'e-mails : si l'envoi echoue, l'invitation existe quand meme
//   et on renvoie email_envoye = false (le Responsable peut renvoyer).
export async function creerInvitation(
  organisationId: string,
  inviteParId: string,
  donnees: DonneesInvitation,
): Promise<ResultatInvitation> {
  if (donnees.site_ids.length > 0) {
    const trouves = await prisma.site.count({
      where: { id: { in: donnees.site_ids }, organisation_id: organisationId, supprime_le: null },
    });
    if (trouves !== donnees.site_ids.length) {
      return { etat: "sites_invalides" };
    }
  }

  // L'adresse e-mail est unique dans toute la base, meme pour un compte supprime.
  const existant = await prisma.utilisateur.findFirst({
    where: { email: { equals: donnees.email, mode: "insensitive" } },
    select: { organisation_id: true, actif: true, supprime_le: true },
  });
  if (existant) {
    if (existant.organisation_id !== organisationId || existant.supprime_le !== null) {
      return { etat: "adresse_indisponible" };
    }
    return { etat: existant.actif ? "deja_membre" : "compte_desactive" };
  }

  const jeton = randomBytes(32).toString("base64url");
  const expireLe = new Date(Date.now() + DUREE_VALIDITE_INVITATION_JOURS * MS_JOUR);

  const invitationId = await prisma.$transaction(async (tx) => {
    await tx.jetonInvitation.deleteMany({
      where: {
        organisation_id: organisationId,
        email: { equals: donnees.email, mode: "insensitive" },
        utilise_le: null,
      },
    });
    const creee = await tx.jetonInvitation.create({
      data: {
        organisation_id: organisationId,
        invite_par_id: inviteParId,
        email: donnees.email,
        role: donnees.role,
        site_ids: donnees.site_ids,
        token_hash: empreinteJeton(jeton),
        expire_le: expireLe,
      },
      select: { id: true },
    });
    return creee.id;
  });

  const organisation = await prisma.organisation.findFirst({
    where: { id: organisationId },
    select: { nom: true },
  });
  const inviteur = await prisma.utilisateur.findFirst({
    where: { id: inviteParId },
    select: { nom: true },
  });

  const message = construireEmail({
    organisationNom: organisation?.nom ?? "votre organisation",
    inviteurNom: inviteur?.nom ?? null,
    role: donnees.role,
    lien: construireLien(jeton),
  });
  const emailEnvoye = await envoyerEmail({ a: donnees.email, ...message });

  const [invitation] = await chercherInvitations(organisationId, invitationId);
  if (!invitation) {
    return { etat: "adresse_indisponible" };
  }
  return { etat: "ok", invitation, email_envoye: emailEnvoye };
}

// ------------------------------------------------------------
// Verification du lien (page publique) et acceptation
// ------------------------------------------------------------

export type InvitationValide = {
  id: string;
  email: string;
  role: Role;
  organisationId: string;
  organisationNom: string;
  // Les sites encore valides (vide pour un Responsable).
  siteIds: string[];
};

export type ResultatVerification =
  | { etat: "ok"; invitation: InvitationValide }
  | { etat: "lien_invalide" }
  | { etat: "sites_indisponibles" };

// Un lien est invalide s'il est absent, inconnu, expire, deja utilise, si l'organisation est
// supprimee ou si l'adresse a deja un compte. Si tous les sites d'un Gestionnaire ont disparu,
// on le dit a part : il faut se faire reinviter.
export async function verifierInvitation(jeton: string): Promise<ResultatVerification> {
  if (jeton === "") {
    return { etat: "lien_invalide" };
  }

  const ligne = await prisma.jetonInvitation.findFirst({
    where: { token_hash: empreinteJeton(jeton), utilise_le: null, expire_le: { gt: new Date() } },
    select: {
      id: true,
      email: true,
      role: true,
      site_ids: true,
      organisation_id: true,
      organisation: { select: { nom: true, supprime_le: true } },
    },
  });
  if (!ligne || ligne.organisation.supprime_le !== null) {
    return { etat: "lien_invalide" };
  }

  const compte = await prisma.utilisateur.findFirst({
    where: { email: { equals: ligne.email, mode: "insensitive" } },
    select: { id: true },
  });
  if (compte) {
    return { etat: "lien_invalide" };
  }

  let siteIds: string[] = [];
  if (ligne.role === "GESTIONNAIRE") {
    const demandes = lireIdsSites(ligne.site_ids);
    const valides: { id: string }[] =
      demandes.length > 0
        ? await prisma.site.findMany({
            where: { id: { in: demandes }, organisation_id: ligne.organisation_id, supprime_le: null },
            select: { id: true },
          })
        : [];
    if (valides.length === 0) {
      return { etat: "sites_indisponibles" };
    }
    siteIds = valides.map((site) => site.id);
  }

  return {
    etat: "ok",
    invitation: {
      id: ligne.id,
      email: ligne.email,
      role: ligne.role,
      organisationId: ligne.organisation_id,
      organisationNom: ligne.organisation.nom,
      siteIds,
    },
  };
}

export type ResultatAcceptation =
  | { etat: "ok"; utilisateurId: string }
  | { etat: "lien_invalide" }
  | { etat: "adresse_indisponible" };

function estErreurUnicite(erreur: unknown): boolean {
  return (
    typeof erreur === "object" &&
    erreur !== null &&
    "code" in erreur &&
    (erreur as { code: unknown }).code === "P2002"
  );
}

// Consomme le lien et cree le compte en une seule transaction (usage unique).
// Le mot de passe arrive deja hache. L'invite n'est PAS connecte : il va sur la page de connexion.
export async function accepterInvitation(params: {
  invitation: InvitationValide;
  nom: string;
  motDePasseHache: string;
}): Promise<ResultatAcceptation> {
  const { invitation } = params;

  try {
    return await prisma.$transaction(async (tx): Promise<ResultatAcceptation> => {
      const maintenant = new Date();

      // Une seule requete peut gagner : la condition utilise_le = null est verifiee en base.
      const marque = await tx.jetonInvitation.updateMany({
        where: { id: invitation.id, utilise_le: null, expire_le: { gt: maintenant } },
        data: { utilise_le: maintenant },
      });
      if (marque.count === 0) {
        return { etat: "lien_invalide" };
      }

      // Les autres invitations en attente pour cette adresse ne servent plus.
      await tx.jetonInvitation.updateMany({
        where: {
          email: { equals: invitation.email, mode: "insensitive" },
          utilise_le: null,
        },
        data: { utilise_le: maintenant },
      });

      const cree = await tx.utilisateur.create({
        data: {
          organisation_id: invitation.organisationId,
          email: invitation.email,
          mot_de_passe_hash: params.motDePasseHache,
          nom: params.nom,
          role: invitation.role,
        },
        select: { id: true },
      });

      if (invitation.siteIds.length > 0) {
        await tx.utilisateurSite.createMany({
          data: invitation.siteIds.map((siteId) => ({ utilisateur_id: cree.id, site_id: siteId })),
        });
      }

      return { etat: "ok", utilisateurId: cree.id };
    });
  } catch (erreur) {
    // Deux acceptations en meme temps, ou adresse prise entre-temps.
    if (estErreurUnicite(erreur)) {
      return { etat: "adresse_indisponible" };
    }
    throw erreur;
  }
}