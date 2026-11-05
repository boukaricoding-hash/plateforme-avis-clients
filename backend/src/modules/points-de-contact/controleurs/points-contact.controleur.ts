import type { Request, Response } from "express";
import { sitesAutorises } from "../../../utilitaires/perimetre";
import { repondreDonneesInvalides, repondreNonTrouve } from "../../../utilitaires/reponses";
import {
  activerPointContact,
  creerPointContact,
  creerPointsContactEnMasse,
  desactiverPointContact,
  listerPointsContact,
  modifierPointContact,
} from "../services/points-contact";
import {
  schemaCreationMasse,
  schemaCreationPointContact,
  schemaFiltrePointsContact,
  schemaIdPointContact,
  schemaModificationPointContact,
} from "../validations/point-contact";

const MESSAGE_SITE_INTROUVABLE = "Site introuvable.";
const MESSAGE_POINT_INTROUVABLE = "Point de contact introuvable.";
const MESSAGE_QUESTIONNAIRE_INTROUVABLE = "Questionnaire introuvable.";

// Les contrôles d'accès ont déjà rempli ces deux valeurs ; on vérifie quand même.
function contexte(req: Request) {
  const utilisateur = req.utilisateur;
  const organisationId = req.organisationId;
  return utilisateur && organisationId ? { utilisateur, organisationId } : null;
}

function repondreNonConnecte(res: Response): void {
  res.status(401).json({ code: "NON_CONNECTE", message: "Vous n'etes pas connecte.", details: null });
}

export async function listerLesPointsContact(req: Request, res: Response): Promise<void> {
  const ctx = contexte(req);
  if (!ctx) return repondreNonConnecte(res);

  const filtre = schemaFiltrePointsContact.safeParse(req.query);
  if (!filtre.success) return repondreDonneesInvalides(res, filtre.error);

  const perimetre = await sitesAutorises(ctx.utilisateur);
  const pointsContact = await listerPointsContact(
    ctx.organisationId,
    perimetre,
    filtre.data.site_id,
  );
  res.status(200).json({ points_contact: pointsContact });
}

export async function creerUnPointContact(req: Request, res: Response): Promise<void> {
  const ctx = contexte(req);
  if (!ctx) return repondreNonConnecte(res);

  const lecture = schemaCreationPointContact.safeParse(req.body);
  if (!lecture.success) return repondreDonneesInvalides(res, lecture.error);

  const resultat = await creerPointContact(ctx.organisationId, lecture.data);
  if (resultat.etat === "site_introuvable") {
    return repondreNonTrouve(res, MESSAGE_SITE_INTROUVABLE);
  }
  if (resultat.etat === "questionnaire_invalide") {
    return repondreNonTrouve(res, MESSAGE_QUESTIONNAIRE_INTROUVABLE);
  }
  res.status(201).json({ point_contact: resultat.point_contact });
}

export async function creerPointsContactMasse(req: Request, res: Response): Promise<void> {
  const ctx = contexte(req);
  if (!ctx) return repondreNonConnecte(res);

  const lecture = schemaCreationMasse.safeParse(req.body);
  if (!lecture.success) return repondreDonneesInvalides(res, lecture.error);

  const resultat = await creerPointsContactEnMasse(ctx.organisationId, lecture.data);
  if (resultat.etat === "site_introuvable") {
    return repondreNonTrouve(res, MESSAGE_SITE_INTROUVABLE);
  }
  if (resultat.etat === "questionnaire_invalide") {
    return repondreNonTrouve(res, MESSAGE_QUESTIONNAIRE_INTROUVABLE);
  }
  res.status(201).json({ crees: resultat.crees, deja_existants: resultat.deja_existants });
}

export async function modifierUnPointContact(req: Request, res: Response): Promise<void> {
  const ctx = contexte(req);
  if (!ctx) return repondreNonConnecte(res);

  const identifiant = schemaIdPointContact.safeParse(req.params);
  if (!identifiant.success) return repondreDonneesInvalides(res, identifiant.error);
  const lecture = schemaModificationPointContact.safeParse(req.body);
  if (!lecture.success) return repondreDonneesInvalides(res, lecture.error);

  const resultat = await modifierPointContact(
    ctx.organisationId,
    identifiant.data.id,
    lecture.data,
  );
  if (resultat.etat === "introuvable") {
    return repondreNonTrouve(res, MESSAGE_POINT_INTROUVABLE);
  }
  if (resultat.etat === "questionnaire_invalide") {
    return repondreNonTrouve(res, MESSAGE_QUESTIONNAIRE_INTROUVABLE);
  }
  res.status(200).json({ point_contact: resultat.point_contact });
}

export async function desactiverUnPointContact(req: Request, res: Response): Promise<void> {
  const ctx = contexte(req);
  if (!ctx) return repondreNonConnecte(res);

  const identifiant = schemaIdPointContact.safeParse(req.params);
  if (!identifiant.success) return repondreDonneesInvalides(res, identifiant.error);

  const pointContact = await desactiverPointContact(ctx.organisationId, identifiant.data.id);
  if (!pointContact) return repondreNonTrouve(res, MESSAGE_POINT_INTROUVABLE);
  res.status(200).json({ point_contact: pointContact });
}

export async function activerUnPointContact(req: Request, res: Response): Promise<void> {
  const ctx = contexte(req);
  if (!ctx) return repondreNonConnecte(res);

  const identifiant = schemaIdPointContact.safeParse(req.params);
  if (!identifiant.success) return repondreDonneesInvalides(res, identifiant.error);

  const pointContact = await activerPointContact(ctx.organisationId, identifiant.data.id);
  if (!pointContact) return repondreNonTrouve(res, MESSAGE_POINT_INTROUVABLE);
  res.status(200).json({ point_contact: pointContact });
}