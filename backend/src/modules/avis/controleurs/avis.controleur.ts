import type { Request, Response } from "express";
import { sitesAutorises } from "../../../utilitaires/perimetre";
import { repondreDonneesInvalides, repondreNonTrouve } from "../../../utilitaires/reponses";
import { listerAvis, lireAvis } from "../services/avis";
import { schemaFiltresAvis, schemaIdAvis } from "../validations/avis";

// Les controles d'acces ont deja rempli ces deux valeurs ; on verifie quand meme.
function contexte(req: Request) {
  const utilisateur = req.utilisateur;
  const organisationId = req.organisationId;
  return utilisateur && organisationId ? { utilisateur, organisationId } : null;
}

function repondreNonConnecte(res: Response): void {
  res.status(401).json({ code: "NON_CONNECTE", message: "Vous n'etes pas connecte.", details: null });
}

// GET /api/v1/avis?from=...&to=...&site=...&statut=...&page=1&limite=20
export async function listerLesAvis(req: Request, res: Response): Promise<void> {
  const ctx = contexte(req);
  if (!ctx) return repondreNonConnecte(res);

  const lecture = schemaFiltresAvis.safeParse(req.query);
  if (!lecture.success) return repondreDonneesInvalides(res, lecture.error);

  const perimetre = await sitesAutorises(ctx.utilisateur);
  const resultat = await listerAvis(ctx.organisationId, perimetre, lecture.data);
  res.status(200).json(resultat);
}

// GET /api/v1/avis/:id
export async function lireUnAvis(req: Request, res: Response): Promise<void> {
  const ctx = contexte(req);
  if (!ctx) return repondreNonConnecte(res);

  const identifiant = schemaIdAvis.safeParse(req.params);
  if (!identifiant.success) return repondreDonneesInvalides(res, identifiant.error);

  const perimetre = await sitesAutorises(ctx.utilisateur);
  const avis = await lireAvis(ctx.organisationId, perimetre, identifiant.data.id);
  // Meme reponse si l'avis n'existe pas, vient d'une autre organisation ou est hors perimetre.
  if (!avis) return repondreNonTrouve(res, "Avis introuvable.");

  res.status(200).json({ avis });
}