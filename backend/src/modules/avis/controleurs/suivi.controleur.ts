import type { Request, Response } from "express";
import { sitesAutorises } from "../../../utilitaires/perimetre";
import { repondreDonneesInvalides, repondreNonTrouve } from "../../../utilitaires/reponses";
import { ajouterNoteInterne, changerStatutAvis } from "../services/suivi";
import { schemaIdAvis } from "../validations/avis";
import { schemaChangementStatut, schemaNoteInterne } from "../validations/suivi";

// Les controles d'acces ont deja rempli ces deux valeurs ; on verifie quand meme.
function contexte(req: Request) {
  const utilisateur = req.utilisateur;
  const organisationId = req.organisationId;
  return utilisateur && organisationId ? { utilisateur, organisationId } : null;
}

function repondreNonConnecte(res: Response): void {
  res.status(401).json({ code: "NON_CONNECTE", message: "Vous n'etes pas connecte.", details: null });
}

// PATCH /api/v1/avis/:id/statut   corps : { "statut": "EN_COURS", "commentaire": "..." }
export async function changerLeStatut(req: Request, res: Response): Promise<void> {
  const ctx = contexte(req);
  if (!ctx) return repondreNonConnecte(res);

  const identifiant = schemaIdAvis.safeParse(req.params);
  if (!identifiant.success) return repondreDonneesInvalides(res, identifiant.error);
  const lecture = schemaChangementStatut.safeParse(req.body);
  if (!lecture.success) return repondreDonneesInvalides(res, lecture.error);

  const perimetre = await sitesAutorises(ctx.utilisateur);
  const resultat = await changerStatutAvis(
    ctx.organisationId,
    perimetre,
    identifiant.data.id,
    ctx.utilisateur.id,
    lecture.data,
  );

  switch (resultat.etat) {
    case "introuvable":
      // Meme reponse si l'avis n'existe pas, vient d'une autre organisation ou est hors perimetre.
      return repondreNonTrouve(res, "Avis introuvable.");
    case "inchange":
      res.status(409).json({
        code: "STATUT_INCHANGE",
        message: "Cet avis a deja ce statut.",
        details: null,
      });
      return;
    case "conflit":
      res.status(409).json({
        code: "CONFLIT_STATUT",
        message: "Le statut de cet avis vient d'etre modifie. Rechargez l'avis puis recommencez.",
        details: null,
      });
      return;
    case "ok":
      res.status(200).json({ statut_traitement: resultat.statut_traitement, suivi: resultat.suivi });
      return;
  }
}

// POST /api/v1/avis/:id/notes   corps : { "commentaire": "..." }
export async function ajouterUneNote(req: Request, res: Response): Promise<void> {
  const ctx = contexte(req);
  if (!ctx) return repondreNonConnecte(res);

  const identifiant = schemaIdAvis.safeParse(req.params);
  if (!identifiant.success) return repondreDonneesInvalides(res, identifiant.error);
  const lecture = schemaNoteInterne.safeParse(req.body);
  if (!lecture.success) return repondreDonneesInvalides(res, lecture.error);

  const perimetre = await sitesAutorises(ctx.utilisateur);
  const suivi = await ajouterNoteInterne(
    ctx.organisationId,
    perimetre,
    identifiant.data.id,
    ctx.utilisateur.id,
    lecture.data.commentaire,
  );
  if (!suivi) return repondreNonTrouve(res, "Avis introuvable.");

  res.status(201).json({ suivi });
}