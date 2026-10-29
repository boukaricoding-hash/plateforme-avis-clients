import type { Request, Response } from "express";
import { sitesAutorises } from "../../../utilitaires/perimetre";
import { repondreDonneesInvalides } from "../../../utilitaires/reponses";
import { calculerKpis } from "../services/kpis";
import { resoudrePeriode, schemaFiltresDashboard } from "../validations/dashboard";

// GET /api/v1/dashboard/kpis?from=2026-11-01&to=2026-11-30&site=...&point=...&questionnaire=...
// Sans from ni to : les 30 derniers jours.
export async function lireLesKpis(req: Request, res: Response): Promise<void> {
  // Les controles d'acces ont deja rempli ces deux valeurs ; on verifie quand meme.
  const utilisateur = req.utilisateur;
  const organisationId = req.organisationId;
  if (!utilisateur || !organisationId) {
    res.status(401).json({ code: "NON_CONNECTE", message: "Vous n'etes pas connecte.", details: null });
    return;
  }

  const lecture = schemaFiltresDashboard.safeParse(req.query);
  if (!lecture.success) {
    repondreDonneesInvalides(res, lecture.error);
    return;
  }
  const filtres = lecture.data;

  const perimetre = await sitesAutorises(utilisateur);
  const resultat = await calculerKpis(
    { organisationId, perimetre, filtres },
    resoudrePeriode(filtres),
  );

  res.status(200).json(resultat);
}