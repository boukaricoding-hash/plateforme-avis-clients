import type { Request, Response } from "express";
import { repondreDonneesInvalides, repondreNonTrouve } from "../../../utilitaires/reponses";
import { enregistrerAudit } from "../../journal-audit/services/journal";
import {
  creerInvitation,
  listerInvitationsEnAttente,
} from "../services/invitations";
import {
  desactiverUtilisateur,
  listerUtilisateurs,
  modifierUtilisateur,
  reactiverUtilisateur,
} from "../services/utilisateurs";
import {
  schemaIdUtilisateur,
  schemaInvitation,
  schemaModificationUtilisateur,
} from "../validations/utilisateurs";

const MESSAGE_INTROUVABLE = "Utilisateur introuvable.";

// Les controles d'acces ont deja rempli ces deux valeurs ; on verifie quand meme.
function contexte(req: Request) {
  const utilisateur = req.utilisateur;
  const organisationId = req.organisationId;
  return utilisateur && organisationId ? { utilisateur, organisationId } : null;
}

function repondreNonConnecte(res: Response): void {
  res.status(401).json({ code: "NON_CONNECTE", message: "Vous n'etes pas connecte.", details: null });
}

function repondreErreur(res: Response, statut: number, code: string, message: string): void {
  res.status(statut).json({ code, message, details: null });
}

// GET /utilisateurs : les utilisateurs de l'organisation et les invitations en attente.
export async function listerLesUtilisateurs(req: Request, res: Response): Promise<void> {
  const ctx = contexte(req);
  if (!ctx) return repondreNonConnecte(res);

  const utilisateurs = await listerUtilisateurs(ctx.organisationId);
  const invitations = await listerInvitationsEnAttente(ctx.organisationId);
  res.status(200).json({ utilisateurs, invitations });
}

// POST /utilisateurs/inviter
export async function inviterUnUtilisateur(req: Request, res: Response): Promise<void> {
  const ctx = contexte(req);
  if (!ctx) return repondreNonConnecte(res);

  const lecture = schemaInvitation.safeParse(req.body);
  if (!lecture.success) return repondreDonneesInvalides(res, lecture.error);

  const resultat = await creerInvitation(ctx.organisationId, ctx.utilisateur.id, lecture.data);

  if (resultat.etat === "sites_invalides") {
    return repondreErreur(res, 400, "SITES_INVALIDES", "Un ou plusieurs sites sont introuvables.");
  }
  if (resultat.etat === "deja_membre") {
    return repondreErreur(
      res,
      409,
      "DEJA_MEMBRE",
      "Cette adresse e-mail a deja un compte dans votre organisation.",
    );
  }
  if (resultat.etat === "compte_desactive") {
    return repondreErreur(
      res,
      409,
      "COMPTE_DESACTIVE",
      "Ce compte est desactive : reactivez-le depuis la liste des utilisateurs.",
    );
  }
  if (resultat.etat === "adresse_indisponible") {
    return repondreErreur(res, 409, "ADRESSE_INDISPONIBLE", "Cette adresse e-mail ne peut pas etre utilisee.");
  }

  // Le journal ne contient jamais l'adresse e-mail de l'invite.
  await enregistrerAudit({
    action: "UTILISATEUR_INVITE",
    utilisateurId: ctx.utilisateur.id,
    organisationId: ctx.organisationId,
    ip: req.ip,
    details: {
      invitation_id: resultat.invitation.id,
      role: resultat.invitation.role,
      nombre_sites: resultat.invitation.sites.length,
      email_envoye: resultat.email_envoye,
    },
  });
  if (!resultat.email_envoye) {
    await enregistrerAudit({
      action: "INVITATION_EMAIL_ECHEC",
      utilisateurId: ctx.utilisateur.id,
      organisationId: ctx.organisationId,
      details: { invitation_id: resultat.invitation.id },
    });
  }

  res.status(201).json({ invitation: resultat.invitation, email_envoye: resultat.email_envoye });
}

// PATCH /utilisateurs/:id : role et/ou sites.
export async function modifierUnUtilisateur(req: Request, res: Response): Promise<void> {
  const ctx = contexte(req);
  if (!ctx) return repondreNonConnecte(res);

  const identifiant = schemaIdUtilisateur.safeParse(req.params);
  if (!identifiant.success) return repondreDonneesInvalides(res, identifiant.error);
  const lecture = schemaModificationUtilisateur.safeParse(req.body);
  if (!lecture.success) return repondreDonneesInvalides(res, lecture.error);

  const resultat = await modifierUtilisateur(
    ctx.organisationId,
    ctx.utilisateur.id,
    identifiant.data.id,
    lecture.data,
  );

  if (resultat.etat === "introuvable") {
    return repondreNonTrouve(res, MESSAGE_INTROUVABLE);
  }
  if (resultat.etat === "soi_meme") {
    return repondreErreur(
      res,
      403,
      "ACTION_SUR_SOI_INTERDITE",
      "Vous ne pouvez pas modifier votre propre compte.",
    );
  }
  if (resultat.etat === "sites_requis") {
    return repondreErreur(res, 400, "SITES_REQUIS", "Un gestionnaire doit avoir au moins un site.");
  }
  if (resultat.etat === "sites_invalides") {
    return repondreErreur(res, 400, "SITES_INVALIDES", "Un ou plusieurs sites sont introuvables.");
  }

  await enregistrerAudit({
    action: "UTILISATEUR_MODIFIE",
    utilisateurId: ctx.utilisateur.id,
    organisationId: ctx.organisationId,
    ip: req.ip,
    details: {
      utilisateur_cible_id: resultat.utilisateur.id,
      ancien_role: resultat.ancien_role,
      nouveau_role: resultat.utilisateur.role,
      nombre_sites: resultat.utilisateur.sites.length,
    },
  });

  res.status(200).json({ utilisateur: resultat.utilisateur });
}

// POST /utilisateurs/:id/desactiver
export async function desactiverUnUtilisateur(req: Request, res: Response): Promise<void> {
  const ctx = contexte(req);
  if (!ctx) return repondreNonConnecte(res);

  const identifiant = schemaIdUtilisateur.safeParse(req.params);
  if (!identifiant.success) return repondreDonneesInvalides(res, identifiant.error);

  const resultat = await desactiverUtilisateur(
    ctx.organisationId,
    ctx.utilisateur.id,
    identifiant.data.id,
  );

  if (resultat.etat === "introuvable") {
    return repondreNonTrouve(res, MESSAGE_INTROUVABLE);
  }
  if (resultat.etat === "soi_meme") {
    return repondreErreur(
      res,
      403,
      "ACTION_SUR_SOI_INTERDITE",
      "Vous ne pouvez pas desactiver votre propre compte.",
    );
  }

  await enregistrerAudit({
    action: "UTILISATEUR_DESACTIVE",
    utilisateurId: ctx.utilisateur.id,
    organisationId: ctx.organisationId,
    ip: req.ip,
    details: { utilisateur_cible_id: resultat.utilisateur.id },
  });

  res.status(200).json({ utilisateur: resultat.utilisateur });
}

// POST /utilisateurs/:id/activer
export async function activerUnUtilisateur(req: Request, res: Response): Promise<void> {
  const ctx = contexte(req);
  if (!ctx) return repondreNonConnecte(res);

  const identifiant = schemaIdUtilisateur.safeParse(req.params);
  if (!identifiant.success) return repondreDonneesInvalides(res, identifiant.error);

  const resultat = await reactiverUtilisateur(ctx.organisationId, identifiant.data.id);
  if (resultat.etat === "introuvable") {
    return repondreNonTrouve(res, MESSAGE_INTROUVABLE);
  }

  await enregistrerAudit({
    action: "UTILISATEUR_REACTIVE",
    utilisateurId: ctx.utilisateur.id,
    organisationId: ctx.organisationId,
    ip: req.ip,
    details: { utilisateur_cible_id: resultat.utilisateur.id },
  });

  res.status(200).json({ utilisateur: resultat.utilisateur });
}