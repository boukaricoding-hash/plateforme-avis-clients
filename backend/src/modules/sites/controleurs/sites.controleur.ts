import type { Request, Response } from "express";
import { sitesAutorises } from "../../../utilitaires/perimetre";
import { repondreDonneesInvalides, repondreNonTrouve } from "../../../utilitaires/reponses";
import { creerSite, desactiverSite, listerSites, modifierSite } from "../services/sites";
import { schemaCreationSite, schemaIdSite, schemaModificationSite } from "../validations/site";

// Les contrôles d'accès ont déjà rempli ces deux valeurs ; on vérifie quand même.
function contexte(req: Request) {
  const utilisateur = req.utilisateur;
  const organisationId = req.organisationId;
  return utilisateur && organisationId ? { utilisateur, organisationId } : null;
}

function repondreNonConnecte(res: Response): void {
  res.status(401).json({ code: "NON_CONNECTE", message: "Vous n'etes pas connecte.", details: null });
}

export async function listerLesSites(req: Request, res: Response): Promise<void> {
  const ctx = contexte(req);
  if (!ctx) return repondreNonConnecte(res);

  const perimetre = await sitesAutorises(ctx.utilisateur);
  const sites = await listerSites(ctx.organisationId, perimetre);
  res.status(200).json({ sites });
}

export async function creerUnSite(req: Request, res: Response): Promise<void> {
  const ctx = contexte(req);
  if (!ctx) return repondreNonConnecte(res);

  const lecture = schemaCreationSite.safeParse(req.body);
  if (!lecture.success) return repondreDonneesInvalides(res, lecture.error);

  const site = await creerSite(ctx.organisationId, lecture.data);
  res.status(201).json({ site });
}

export async function modifierUnSite(req: Request, res: Response): Promise<void> {
  const ctx = contexte(req);
  if (!ctx) return repondreNonConnecte(res);

  const identifiant = schemaIdSite.safeParse(req.params);
  if (!identifiant.success) return repondreDonneesInvalides(res, identifiant.error);
  const lecture = schemaModificationSite.safeParse(req.body);
  if (!lecture.success) return repondreDonneesInvalides(res, lecture.error);

  const site = await modifierSite(ctx.organisationId, identifiant.data.id, lecture.data);
  if (!site) return repondreNonTrouve(res, "Site introuvable.");
  res.status(200).json({ site });
}

export async function desactiverUnSite(req: Request, res: Response): Promise<void> {
  const ctx = contexte(req);
  if (!ctx) return repondreNonConnecte(res);

  const identifiant = schemaIdSite.safeParse(req.params);
  if (!identifiant.success) return repondreDonneesInvalides(res, identifiant.error);

  const site = await desactiverSite(ctx.organisationId, identifiant.data.id);
  if (!site) return repondreNonTrouve(res, "Site introuvable.");
  res.status(200).json({ site });
}