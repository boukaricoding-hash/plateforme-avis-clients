import type { Request, Response } from "express";
import { repondreDonneesInvalides, repondreNonTrouve } from "../../../utilitaires/reponses";
import {
  creerQuestionnaire,
  lireQuestionnaire,
  listerQuestionnaires,
  modifierQuestionnaire,
  themesValides,
} from "../services/questionnaires";
import { dupliquerQuestionnaire, publierQuestionnaire } from "../services/publication";
import {
  activerQuestionnaire,
  desactiverQuestionnaire,
  type ResultatStatut,
} from "../services/activation";
import { modifierDatesQuestionnaire } from "../services/dates";
import { associerPointsContact } from "../services/points-contact";
import { schemaDatesQuestionnaire } from "../validations/dates";
import { schemaAssociationPointsContact } from "../validations/points-contact";
import { schemaIdQuestionnaire, schemaQuestionnaire } from "../validations/questionnaire";

// Les controles d'acces ont deja rempli ces deux valeurs ; on verifie quand meme.
function contexte(req: Request) {
  const utilisateur = req.utilisateur;
  const organisationId = req.organisationId;
  return utilisateur && organisationId ? { utilisateur, organisationId } : null;
}

function repondreNonConnecte(res: Response): void {
  res.status(401).json({ code: "NON_CONNECTE", message: "Vous n'etes pas connecte.", details: null });
}

function repondreThemesInvalides(res: Response): void {
  res.status(400).json({
    code: "DONNEES_INVALIDES",
    message: "Les donnees envoyees sont invalides.",
    details: [{ champ: "questions", message: "Un theme n'appartient pas au secteur de l'organisation." }],
  });
}

const MESSAGE_INTROUVABLE = "Questionnaire introuvable.";

// Reponse commune a l'activation et a la desactivation.
function repondreStatut(res: Response, resultat: ResultatStatut): void {
  if (resultat.etat === "introuvable") {
    return repondreNonTrouve(res, MESSAGE_INTROUVABLE);
  }
  if (resultat.etat === "non_publie") {
    res.status(409).json({
      code: "NON_PUBLIE",
      message: "Ce questionnaire n'a jamais ete publie : publiez-le d'abord.",
      details: null,
    });
    return;
  }
  res.status(200).json({ questionnaire: { id: resultat.id, statut: resultat.statut } });
}

export async function listerLesQuestionnaires(req: Request, res: Response): Promise<void> {
  const ctx = contexte(req);
  if (!ctx) return repondreNonConnecte(res);

  const questionnaires = await listerQuestionnaires(ctx.organisationId);
  res.status(200).json({ questionnaires });
}

export async function creerUnQuestionnaire(req: Request, res: Response): Promise<void> {
  const ctx = contexte(req);
  if (!ctx) return repondreNonConnecte(res);

  const lecture = schemaQuestionnaire.safeParse(req.body);
  if (!lecture.success) return repondreDonneesInvalides(res, lecture.error);
  if (!(await themesValides(ctx.organisationId, lecture.data.questions))) {
    return repondreThemesInvalides(res);
  }

  const id = await creerQuestionnaire(ctx.organisationId, lecture.data);
  const questionnaire = await lireQuestionnaire(ctx.organisationId, id);
  res.status(201).json({ questionnaire });
}

export async function lireUnQuestionnaire(req: Request, res: Response): Promise<void> {
  const ctx = contexte(req);
  if (!ctx) return repondreNonConnecte(res);

  const identifiant = schemaIdQuestionnaire.safeParse(req.params);
  if (!identifiant.success) return repondreDonneesInvalides(res, identifiant.error);

  const questionnaire = await lireQuestionnaire(ctx.organisationId, identifiant.data.id);
  if (!questionnaire) return repondreNonTrouve(res, MESSAGE_INTROUVABLE);
  res.status(200).json({ questionnaire });
}

export async function modifierUnQuestionnaire(req: Request, res: Response): Promise<void> {
  const ctx = contexte(req);
  if (!ctx) return repondreNonConnecte(res);

  const identifiant = schemaIdQuestionnaire.safeParse(req.params);
  if (!identifiant.success) return repondreDonneesInvalides(res, identifiant.error);
  const lecture = schemaQuestionnaire.safeParse(req.body);
  if (!lecture.success) return repondreDonneesInvalides(res, lecture.error);
  if (!(await themesValides(ctx.organisationId, lecture.data.questions))) {
    return repondreThemesInvalides(res);
  }

  const resultat = await modifierQuestionnaire(ctx.organisationId, identifiant.data.id, lecture.data);
  if (!resultat) return repondreNonTrouve(res, MESSAGE_INTROUVABLE);

  const questionnaire = await lireQuestionnaire(ctx.organisationId, resultat.id);
  res.status(200).json({ questionnaire, nouvelle_version: resultat.nouvelle_version });
}

export async function publierUnQuestionnaire(req: Request, res: Response): Promise<void> {
  const ctx = contexte(req);
  if (!ctx) return repondreNonConnecte(res);

  const identifiant = schemaIdQuestionnaire.safeParse(req.params);
  if (!identifiant.success) return repondreDonneesInvalides(res, identifiant.error);

  const publication = await publierQuestionnaire(ctx.organisationId, identifiant.data.id);
  if (!publication) return repondreNonTrouve(res, MESSAGE_INTROUVABLE);
  res.status(200).json({ publication });
}

export async function dupliquerUnQuestionnaire(req: Request, res: Response): Promise<void> {
  const ctx = contexte(req);
  if (!ctx) return repondreNonConnecte(res);

  const identifiant = schemaIdQuestionnaire.safeParse(req.params);
  if (!identifiant.success) return repondreDonneesInvalides(res, identifiant.error);

  const idCopie = await dupliquerQuestionnaire(ctx.organisationId, identifiant.data.id);
  if (!idCopie) return repondreNonTrouve(res, MESSAGE_INTROUVABLE);

  const questionnaire = await lireQuestionnaire(ctx.organisationId, idCopie);
  res.status(201).json({ questionnaire });
}

export async function activerUnQuestionnaire(req: Request, res: Response): Promise<void> {
  const ctx = contexte(req);
  if (!ctx) return repondreNonConnecte(res);

  const identifiant = schemaIdQuestionnaire.safeParse(req.params);
  if (!identifiant.success) return repondreDonneesInvalides(res, identifiant.error);

  repondreStatut(res, await activerQuestionnaire(ctx.organisationId, identifiant.data.id));
}

export async function desactiverUnQuestionnaire(req: Request, res: Response): Promise<void> {
  const ctx = contexte(req);
  if (!ctx) return repondreNonConnecte(res);

  const identifiant = schemaIdQuestionnaire.safeParse(req.params);
  if (!identifiant.success) return repondreDonneesInvalides(res, identifiant.error);

  repondreStatut(res, await desactiverQuestionnaire(ctx.organisationId, identifiant.data.id));
}

export async function modifierLesDatesDuQuestionnaire(req: Request, res: Response): Promise<void> {
  const ctx = contexte(req);
  if (!ctx) return repondreNonConnecte(res);

  const identifiant = schemaIdQuestionnaire.safeParse(req.params);
  if (!identifiant.success) return repondreDonneesInvalides(res, identifiant.error);
  const lecture = schemaDatesQuestionnaire.safeParse(req.body);
  if (!lecture.success) return repondreDonneesInvalides(res, lecture.error);

  const questionnaire = await modifierDatesQuestionnaire(
    ctx.organisationId,
    identifiant.data.id,
    lecture.data,
  );
  if (!questionnaire) return repondreNonTrouve(res, MESSAGE_INTROUVABLE);
  res.status(200).json({ questionnaire });
}

export async function associerLesPointsContact(req: Request, res: Response): Promise<void> {
  const ctx = contexte(req);
  if (!ctx) return repondreNonConnecte(res);

  const identifiant = schemaIdQuestionnaire.safeParse(req.params);
  if (!identifiant.success) return repondreDonneesInvalides(res, identifiant.error);
  const lecture = schemaAssociationPointsContact.safeParse(req.body);
  if (!lecture.success) return repondreDonneesInvalides(res, lecture.error);

  const resultat = await associerPointsContact(
    ctx.organisationId,
    identifiant.data.id,
    lecture.data.points_contact_ids,
  );
  if (resultat.etat === "introuvable") {
    return repondreNonTrouve(res, MESSAGE_INTROUVABLE);
  }
  if (resultat.etat === "points_invalides") {
    return repondreNonTrouve(res, "Point de contact introuvable.");
  }
  res.status(200).json({ points_contact: resultat.points_contact });
}