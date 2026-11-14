import type { Request, Response } from "express";
import { lireVueGlobale } from "../services/vue-globale";

// La route passe par exigerConnexion et exigerRole("ADMINISTRATEUR") : pas d'organisation ici,
// les chiffres de toute la plateforme sont lus. Aucun parametre : rien a valider.
function repondreNonConnecte(res: Response): void {
  res.status(401).json({ code: "NON_CONNECTE", message: "Vous n'êtes pas connecté.", details: null });
}

// GET /admin/vue-globale
export async function lireLaVueGlobale(req: Request, res: Response): Promise<void> {
  if (!req.utilisateur) return repondreNonConnecte(res);

  const vue = await lireVueGlobale();
  res.status(200).json(vue);
}