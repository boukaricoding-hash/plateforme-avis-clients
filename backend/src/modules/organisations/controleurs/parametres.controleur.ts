import type { Request, Response } from "express";
import { repondreDonneesInvalides, repondreNonTrouve } from "../../../utilitaires/reponses";
import { lireParametres, modifierParametres } from "../services/parametres";
import { schemaModificationParametres } from "../validations/parametres";

// Les controles d'acces ont deja rempli ces deux valeurs ; on verifie quand meme.
function contexte(req: Request) {
  const utilisateur = req.utilisateur;
  const organisationId = req.organisationId;
  return utilisateur && organisationId ? { utilisateur, organisationId } : null;
}

function repondreNonConnecte(res: Response): void {
  res.status(401).json({ code: "NON_CONNECTE", message: "Vous n'êtes pas connecté.", details: null });
}

// GET /api/v1/organisation/parametres
export async function lireLesParametres(req: Request, res: Response): Promise<void> {
  const ctx = contexte(req);
  if (!ctx) return repondreNonConnecte(res);

  const parametres = await lireParametres(ctx.organisationId);
  if (!parametres) return repondreNonTrouve(res, "Organisation introuvable.");
  res.status(200).json({ parametres });
}

// PATCH /api/v1/organisation/parametres
export async function modifierLesParametres(req: Request, res: Response): Promise<void> {
  const ctx = contexte(req);
  if (!ctx) return repondreNonConnecte(res);

  const lecture = schemaModificationParametres.safeParse(req.body);
  if (!lecture.success) return repondreDonneesInvalides(res, lecture.error);

  const parametres = await modifierParametres({
    organisationId: ctx.organisationId,
    utilisateurId: ctx.utilisateur.id,
    ip: req.ip,
    donnees: lecture.data,
  });
  if (!parametres) return repondreNonTrouve(res, "Organisation introuvable.");
  res.status(200).json({ parametres });
}