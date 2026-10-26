import type { Request, Response } from "express";
import { repondreDonneesInvalides, repondreNonTrouve } from "../../../utilitaires/reponses";
import { listerNotifications, marquerNotificationLue } from "../services/notifications";
import { schemaFiltresNotifications, schemaIdNotification } from "../validations/notifications";

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
// Chaque utilisateur ne voit que SES notifications.
export async function listerMesNotifications(req: Request, res: Response): Promise<void> {
  const ctx = contexte(req);
  if (!ctx) return repondreNonConnecte(res);

  const lecture = schemaFiltresNotifications.safeParse(req.query);
  if (!lecture.success) return repondreDonneesInvalides(res, lecture.error);

  const resultat = await listerNotifications(ctx.organisationId, ctx.utilisateur.id, lecture.data);
  res.status(200).json(resultat);
}

// POST /api/v1/notifications/:id/lue
export async function marquerUneNotificationLue(req: Request, res: Response): Promise<void> {
  const ctx = contexte(req);
  if (!ctx) return repondreNonConnecte(res);

  const identifiant = schemaIdNotification.safeParse(req.params);
  if (!identifiant.success) return repondreDonneesInvalides(res, identifiant.error);

  const notification = await marquerNotificationLue(ctx.organisationId, ctx.utilisateur.id, identifiant.data.id);
  // Meme reponse si la notification n'existe pas ou appartient a quelqu'un d'autre.
  if (!notification) return repondreNonTrouve(res, "Notification introuvable.");

  res.status(200).json({ notification });
}