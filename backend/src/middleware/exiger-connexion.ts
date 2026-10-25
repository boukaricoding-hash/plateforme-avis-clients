import type { NextFunction, Request, Response } from "express";
import { prisma } from "../configuration/base-de-donnees";
import {
  NOM_COOKIE_SESSION,
  prolongerSession,
  trouverSessionActive,
} from "../modules/authentification/services/sessions";

export type UtilisateurConnecte = {
  id: string;
  email: string;
  role: "RESPONSABLE" | "GESTIONNAIRE" | "ADMINISTRATEUR";
  organisation_id: string | null;
};

// Ajoute req.utilisateur a Express : les routes protegees le liront ici,
// jamais depuis ce que le navigateur envoie.
declare global {
  namespace Express {
    interface Request {
      utilisateur?: UtilisateurConnecte;
    }
  }
}

export async function exigerConnexion(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const jeton: unknown = req.cookies?.[NOM_COOKIE_SESSION];
  const session =
    typeof jeton === "string" && jeton !== "" ? await trouverSessionActive(jeton) : null;

  const utilisateur = session
    ? await prisma.utilisateur.findFirst({
        where: { id: session.utilisateur_id, actif: true, supprime_le: null },
        select: { id: true, email: true, role: true, organisation_id: true },
      })
    : null;

  if (!session || !utilisateur) {
    res.status(401).json({
      code: "NON_CONNECTE",
      message: "Vous n'etes pas connecte.",
      details: null,
    });
    return;
  }

  await prolongerSession(session);
  req.utilisateur = utilisateur;
  next();
}