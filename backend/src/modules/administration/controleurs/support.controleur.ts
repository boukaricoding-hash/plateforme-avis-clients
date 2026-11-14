import type { Request, Response } from "express";
import { schemaFiltresAvis, schemaIdAvis } from "../../avis/validations/avis";
import { schemaFiltresDashboard } from "../../tableaux-de-bord/validations/dashboard";
import { repondreDonneesInvalides, repondreNonTrouve } from "../../../utilitaires/reponses";
import {
  lireAvisSupport,
  lireFicheSupport,
  lireIndicateursSupport,
  listerAvisSupport,
  listerPointsContactSupport,
  listerSitesSupport,
  listerUtilisateursSupport,
} from "../services/consultation-support";

// Consultation de support : lecture seule, GET uniquement.
// Les routes passent par exigerConnexion, exigerRole("ADMINISTRATEUR") puis exigerAccesSupport(partie),
// qui verifie l'accord de l'organisation a chaque requete et remplit req.accesSupport.
// L'organisation consultee est lue UNIQUEMENT dans req.accesSupport, jamais directement dans l'adresse.
function organisationConsultee(req: Request, res: Response): string | null {
  const organisationId = req.accesSupport?.organisationId;
  if (organisationId === undefined) {
    res.status(403).json({
      code: "ACCES_SUPPORT_NON_ACCORDE",
      message: "Cette organisation n'a pas donné son accord.",
      details: null,
    });
    return null;
  }
  return organisationId;
}

// GET /admin/support/organisations/:id
export async function lireLaFicheSupport(req: Request, res: Response): Promise<void> {
  const organisationId = organisationConsultee(req, res);
  if (organisationId === null) return;

  const organisation = await lireFicheSupport(organisationId);
  if (!organisation) return repondreNonTrouve(res, "Organisation introuvable.");
  res.status(200).json({ organisation });
}

// GET /admin/support/organisations/:id/indicateurs?from=...&to=...&site=...&point=...&questionnaire=...
// Sans from ni to : les 30 derniers jours.
export async function lireLesIndicateursSupport(req: Request, res: Response): Promise<void> {
  const organisationId = organisationConsultee(req, res);
  if (organisationId === null) return;

  const lecture = schemaFiltresDashboard.safeParse(req.query);
  if (!lecture.success) return repondreDonneesInvalides(res, lecture.error);

  const resultat = await lireIndicateursSupport(organisationId, lecture.data);
  res.status(200).json(resultat);
}

// GET /admin/support/organisations/:id/avis?page=...&limite=...&statut=...&q=...
// Memes filtres que la liste des avis du Responsable. Aucune coordonnee de client.
export async function listerLesAvisSupport(req: Request, res: Response): Promise<void> {
  const organisationId = organisationConsultee(req, res);
  if (organisationId === null) return;

  const lecture = schemaFiltresAvis.safeParse(req.query);
  if (!lecture.success) return repondreDonneesInvalides(res, lecture.error);

  const resultat = await listerAvisSupport(organisationId, lecture.data);
  res.status(200).json(resultat);
}

// GET /admin/support/organisations/:id/avis/:avisId
// Le detail d'un avis, avec ses notes et son historique ; les coordonnees du client sont masquees (contact : null).
export async function lireUnAvisSupport(req: Request, res: Response): Promise<void> {
  const organisationId = organisationConsultee(req, res);
  if (organisationId === null) return;

  const identifiant = schemaIdAvis.safeParse({ id: req.params["avisId"] });
  if (!identifiant.success) return repondreDonneesInvalides(res, identifiant.error);

  const avis = await lireAvisSupport(organisationId, identifiant.data.id);
  // Meme reponse si l'avis n'existe pas ou appartient a une autre organisation.
  if (!avis) return repondreNonTrouve(res, "Avis introuvable.");
  res.status(200).json({ avis });
}

// GET /admin/support/organisations/:id/sites
export async function listerLesSitesSupport(req: Request, res: Response): Promise<void> {
  const organisationId = organisationConsultee(req, res);
  if (organisationId === null) return;

  const sites = await listerSitesSupport(organisationId);
  res.status(200).json({ sites });
}

// GET /admin/support/organisations/:id/points-contact
export async function listerLesPointsContactSupport(req: Request, res: Response): Promise<void> {
  const organisationId = organisationConsultee(req, res);
  if (organisationId === null) return;

  const pointsContact = await listerPointsContactSupport(organisationId);
  res.status(200).json({ points_contact: pointsContact });
}

// GET /admin/support/organisations/:id/utilisateurs
// Jamais de mot de passe : la lecture ne le charge pas.
export async function listerLesUtilisateursSupport(req: Request, res: Response): Promise<void> {
  const organisationId = organisationConsultee(req, res);
  if (organisationId === null) return;

  const utilisateurs = await listerUtilisateursSupport(organisationId);
  res.status(200).json({ utilisateurs });
}