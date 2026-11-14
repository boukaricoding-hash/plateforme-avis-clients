import type { Request, Response } from "express";
import { repondreDonneesInvalides } from "../../../utilitaires/reponses";
import { consulterLeJournal } from "../services/consultation-journal";
import { schemaFiltresJournal } from "../validations/journal";

// La route passe par exigerConnexion et exigerRole("ADMINISTRATEUR") : pas d'organisation ici,
// le journal de toutes les organisations est lu.
function repondreNonConnecte(res: Response): void {
  res.status(401).json({ code: "NON_CONNECTE", message: "Vous n'êtes pas connecté.", details: null });
}

// GET /admin/journal-audit?page=...&limite=...&utilisateur=...&action=...&organisation=...&du=...&au=...
export async function lireLeJournal(req: Request, res: Response): Promise<void> {
  if (!req.utilisateur) return repondreNonConnecte(res);

  const filtres = schemaFiltresJournal.safeParse(req.query);
  if (!filtres.success) return repondreDonneesInvalides(res, filtres.error);

  const resultat = await consulterLeJournal(filtres.data);
  res.status(200).json(resultat);
}