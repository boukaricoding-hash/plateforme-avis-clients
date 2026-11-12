import type { Request, Response } from "express";
import { repondreDonneesInvalides, repondreNonTrouve } from "../../../utilitaires/reponses";
import {
  creerOrganisation,
  lireOrganisation,
  listerOrganisations,
  modifierOrganisation,
  reactiverOrganisation,
  suspendreOrganisation,
} from "../services/organisations";
import { inviterPremierResponsable } from "../services/premier-responsable";
import {
  schemaCreationOrganisation,
  schemaFiltresOrganisations,
  schemaIdOrganisation,
  schemaInvitationPremierResponsable,
  schemaModificationOrganisation,
} from "../validations/organisations";

const MESSAGE_INTROUVABLE = "Organisation introuvable.";

// Les routes admin passent par exigerConnexion et exigerRole("ADMINISTRATEUR") : pas d'organisation ici.
// On verifie quand meme que l'utilisateur est la, puis on prepare "qui fait l'action" pour le journal.
function acteur(req: Request): { utilisateurId: string; ip: string | undefined } | null {
  const utilisateur = req.utilisateur;
  return utilisateur ? { utilisateurId: utilisateur.id, ip: req.ip } : null;
}

function repondreNonConnecte(res: Response): void {
  res.status(401).json({ code: "NON_CONNECTE", message: "Vous n'êtes pas connecté.", details: null });
}

function repondreErreur(res: Response, statut: number, code: string, message: string): void {
  res.status(statut).json({ code, message, details: null });
}

// GET /admin/organisations?statut=...&secteur=...&q=...&page=...&limite=...
export async function listerLesOrganisations(req: Request, res: Response): Promise<void> {
  if (!acteur(req)) return repondreNonConnecte(res);

  const filtres = schemaFiltresOrganisations.safeParse(req.query);
  if (!filtres.success) return repondreDonneesInvalides(res, filtres.error);

  const resultat = await listerOrganisations(filtres.data);
  res.status(200).json(resultat);
}

// GET /admin/organisations/:id
export async function lireUneOrganisation(req: Request, res: Response): Promise<void> {
  if (!acteur(req)) return repondreNonConnecte(res);

  const identifiant = schemaIdOrganisation.safeParse(req.params);
  if (!identifiant.success) return repondreDonneesInvalides(res, identifiant.error);

  const organisation = await lireOrganisation(identifiant.data.id);
  if (!organisation) return repondreNonTrouve(res, MESSAGE_INTROUVABLE);

  res.status(200).json({ organisation });
}

// POST /admin/organisations
// Cree l'organisation et clone le modele de son secteur (le service ecrit le journal d'audit).
export async function creerUneOrganisation(req: Request, res: Response): Promise<void> {
  const qui = acteur(req);
  if (!qui) return repondreNonConnecte(res);

  const lecture = schemaCreationOrganisation.safeParse(req.body);
  if (!lecture.success) return repondreDonneesInvalides(res, lecture.error);

  const resultat = await creerOrganisation(qui, lecture.data);
  if (resultat.etat === "secteur_invalide") {
    return repondreErreur(
      res,
      400,
      "SECTEUR_INVALIDE",
      "Ce secteur n'existe pas ou n'est plus actif.",
    );
  }

  res
    .status(201)
    .json({ organisation: resultat.organisation, questionnaire_id: resultat.questionnaire_id });
}

// PATCH /admin/organisations/:id
export async function modifierUneOrganisation(req: Request, res: Response): Promise<void> {
  const qui = acteur(req);
  if (!qui) return repondreNonConnecte(res);

  const identifiant = schemaIdOrganisation.safeParse(req.params);
  if (!identifiant.success) return repondreDonneesInvalides(res, identifiant.error);
  const lecture = schemaModificationOrganisation.safeParse(req.body);
  if (!lecture.success) return repondreDonneesInvalides(res, lecture.error);

  const organisation = await modifierOrganisation(qui, identifiant.data.id, lecture.data);
  if (!organisation) return repondreNonTrouve(res, MESSAGE_INTROUVABLE);

  res.status(200).json({ organisation });
}

// POST /admin/organisations/:id/suspendre
export async function suspendreUneOrganisation(req: Request, res: Response): Promise<void> {
  const qui = acteur(req);
  if (!qui) return repondreNonConnecte(res);

  const identifiant = schemaIdOrganisation.safeParse(req.params);
  if (!identifiant.success) return repondreDonneesInvalides(res, identifiant.error);

  const resultat = await suspendreOrganisation(qui, identifiant.data.id);
  if (resultat.etat === "introuvable") return repondreNonTrouve(res, MESSAGE_INTROUVABLE);
  if (resultat.etat === "deja_dans_cet_etat") {
    return repondreErreur(res, 409, "DEJA_SUSPENDUE", "Cette organisation est déjà suspendue.");
  }

  res.status(200).json({ organisation: resultat.organisation });
}

// POST /admin/organisations/:id/reactiver
export async function reactiverUneOrganisation(req: Request, res: Response): Promise<void> {
  const qui = acteur(req);
  if (!qui) return repondreNonConnecte(res);

  const identifiant = schemaIdOrganisation.safeParse(req.params);
  if (!identifiant.success) return repondreDonneesInvalides(res, identifiant.error);

  const resultat = await reactiverOrganisation(qui, identifiant.data.id);
  if (resultat.etat === "introuvable") return repondreNonTrouve(res, MESSAGE_INTROUVABLE);
  if (resultat.etat === "deja_dans_cet_etat") {
    return repondreErreur(res, 409, "PAS_SUSPENDUE", "Cette organisation n'est pas suspendue.");
  }

  res.status(200).json({ organisation: resultat.organisation });
}

// POST /admin/organisations/:id/inviter-responsable
// Seule l'adresse e-mail est envoyee. Si l'e-mail ne part pas, l'invitation existe quand meme
// (email_envoye = false) : on peut rappeler cette route pour la renvoyer.
export async function inviterLePremierResponsable(req: Request, res: Response): Promise<void> {
  const qui = acteur(req);
  if (!qui) return repondreNonConnecte(res);

  const identifiant = schemaIdOrganisation.safeParse(req.params);
  if (!identifiant.success) return repondreDonneesInvalides(res, identifiant.error);
  const lecture = schemaInvitationPremierResponsable.safeParse(req.body);
  if (!lecture.success) return repondreDonneesInvalides(res, lecture.error);

  const resultat = await inviterPremierResponsable(qui, identifiant.data.id, lecture.data);

  if (resultat.etat === "organisation_introuvable") {
    return repondreNonTrouve(res, MESSAGE_INTROUVABLE);
  }
  if (resultat.etat === "responsable_existant") {
    return repondreErreur(
      res,
      409,
      "RESPONSABLE_EXISTANT",
      "Cette organisation a déjà un responsable actif. Il invite lui-même ses collègues.",
    );
  }
  if (resultat.etat === "deja_membre") {
    return repondreErreur(
      res,
      409,
      "DEJA_MEMBRE",
      "Cette adresse e-mail a déjà un compte actif dans cette organisation.",
    );
  }
  if (resultat.etat === "compte_desactive") {
    return repondreErreur(
      res,
      409,
      "COMPTE_DESACTIVE",
      "Cette adresse e-mail a un compte désactivé dans cette organisation.",
    );
  }
  if (resultat.etat === "adresse_indisponible") {
    return repondreErreur(
      res,
      409,
      "ADRESSE_INDISPONIBLE",
      "Cette adresse e-mail ne peut pas être utilisée.",
    );
  }
  if (resultat.etat === "sites_invalides") {
    // Impossible ici (aucun site n'est envoye) : on garde le cas pour que le typage soit complet.
    return repondreErreur(res, 400, "SITES_INVALIDES", "Un ou plusieurs sites sont introuvables.");
  }

  res.status(201).json({ invitation: resultat.invitation, email_envoye: resultat.email_envoye });
}
