import type { Request, Response } from "express";
import { sitesAutorises } from "../../../utilitaires/perimetre";
import { repondreDonneesInvalides, repondreNonTrouve } from "../../../utilitaires/reponses";
import {
  lirePreferencesNotifications,
  listerNotifications,
  marquerNotificationLue,
  modifierPreferencesNotifications,
} from "../services/notifications";
import {
  schemaFiltresNotifications,
  schemaIdNotification,
  schemaModificationPreferencesNotifications,
} from "../validations/notifications";

// Les controles d'acces ont deja rempli ces deux valeurs ; on verifie quand meme.
function contexte(req: Request) {
  const utilisateur = req.utilisateur;
  const organisationId = req.organisationId;
  return utilisateur && organisationId ? { utilisateur, organisationId } : null;
}

function repondreNonConnecte(res: Response): void {
  res.status(401).json({ code: "NON_CONNECTE", message: "Vous n'etes pas connecte.", details: null });
}

// GET /api/v1/notifications?non_lues=true&page=1&limite=20
// Chaque utilisateur ne voit que SES notifications ; un Gestionnaire, seulement celles de ses sites.
export async function listerMesNotifications(req: Request, res: Response): Promise<void> {
  const ctx = contexte(req);
  if (!ctx) return repondreNonConnecte(res);

  const lecture = schemaFiltresNotifications.safeParse(req.query);
  if (!lecture.success) return repondreDonneesInvalides(res, lecture.error);

  const perimetre = await sitesAutorises(ctx.utilisateur);
  const resultat = await listerNotifications(ctx.organisationId, ctx.utilisateur.id, perimetre, lecture.data);
  res.status(200).json(resultat);
}

// POST /api/v1/notifications/:id/lue
export async function marquerUneNotificationLue(req: Request, res: Response): Promise<void> {
  const ctx = contexte(req);
  if (!ctx) return repondreNonConnecte(res);

  const identifiant = schemaIdNotification.safeParse(req.params);
  if (!identifiant.success) return repondreDonneesInvalides(res, identifiant.error);

  const perimetre = await sitesAutorises(ctx.utilisateur);
  const notification = await marquerNotificationLue(
    ctx.organisationId,
    ctx.utilisateur.id,
    perimetre,
    identifiant.data.id,
  );
  // Meme reponse si la notification n'existe pas, appartient a quelqu'un d'autre ou est hors perimetre.
  if (!notification) return repondreNonTrouve(res, "Notification introuvable.");

  res.status(200).json({ notification });
}

// GET /api/v1/notifications/preferences
// Les preferences de l'utilisateur connecte (jamais celles d'un autre).
export async function lireMesPreferences(req: Request, res: Response): Promise<void> {
  const ctx = contexte(req);
  if (!ctx) return repondreNonConnecte(res);

  const preferences = await lirePreferencesNotifications(ctx.organisationId, ctx.utilisateur.id);
  if (!preferences) return repondreNonTrouve(res, "Utilisateur introuvable.");

  res.status(200).json({ preferences });
}

// PATCH /api/v1/notifications/preferences
export async function modifierMesPreferences(req: Request, res: Response): Promise<void> {
  const ctx = contexte(req);
  if (!ctx) return repondreNonConnecte(res);

  const lecture = schemaModificationPreferencesNotifications.safeParse(req.body);
  if (!lecture.success) return repondreDonneesInvalides(res, lecture.error);

  const preferences = await modifierPreferencesNotifications(
    ctx.organisationId,
    ctx.utilisateur.id,
    lecture.data,
  );
  if (!preferences) return repondreNonTrouve(res, "Utilisateur introuvable.");

  res.status(200).json({ preferences });
}