import type { Request, Response } from "express";
import { repondreDonneesInvalides } from "../../../utilitaires/reponses";
import { accorderAcces, retirerAcces, trouverAccordActif } from "../services/acces-support";
import { schemaAccordSupport } from "../validations/acces-support";

// Les controles d'acces ont deja rempli ces deux valeurs ; on verifie quand meme.
// L'organisation vient toujours de la session : jamais de l'adresse ni du corps de la requete.
function contexte(req: Request) {
  const utilisateur = req.utilisateur;
  const organisationId = req.organisationId;
  return utilisateur && organisationId ? { utilisateur, organisationId } : null;
}

function repondreNonConnecte(res: Response): void {
  res.status(401).json({ code: "NON_CONNECTE", message: "Vous n'êtes pas connecté.", details: null });
}

// GET /api/v1/organisation/acces-support
// Renvoie l'accord actif, ou { acces: null } s'il n'y en a pas.
export async function lireLAccesSupport(req: Request, res: Response): Promise<void> {
  const ctx = contexte(req);
  if (!ctx) return repondreNonConnecte(res);

  const acces = await trouverAccordActif(ctx.organisationId);
  res.status(200).json({ acces });
}

// POST /api/v1/organisation/acces-support   corps : { "duree": "UNE_HEURE" }
// Un nouvel accord remplace l'accord actif.
export async function accorderLAccesSupport(req: Request, res: Response): Promise<void> {
  const ctx = contexte(req);
  if (!ctx) return repondreNonConnecte(res);

  const lecture = schemaAccordSupport.safeParse(req.body);
  if (!lecture.success) return repondreDonneesInvalides(res, lecture.error);

  const acces = await accorderAcces({
    organisationId: ctx.organisationId,
    utilisateurId: ctx.utilisateur.id,
    ip: req.ip,
    duree: lecture.data.duree,
  });
  res.status(201).json({ acces });
}

// DELETE /api/v1/organisation/acces-support
// Sans accord actif, la reponse reste 200 { acces: null } : retirer deux fois ne provoque pas d'erreur.
export async function retirerLAccesSupport(req: Request, res: Response): Promise<void> {
  const ctx = contexte(req);
  if (!ctx) return repondreNonConnecte(res);

  await retirerAcces({
    organisationId: ctx.organisationId,
    utilisateurId: ctx.utilisateur.id,
    ip: req.ip,
  });
  res.status(200).json({ acces: null });
}