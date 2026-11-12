import type { Request, Response } from "express";
import { repondreDonneesInvalides, repondreNonTrouve } from "../../../utilitaires/reponses";
import {
  creerSecteur,
  creerTheme,
  lireSecteur,
  listerQuestionnairesTypes,
  listerSecteurs,
  modifierSecteur,
  modifierTheme,
} from "../services/secteurs";
import {
  schemaCreationSecteur,
  schemaCreationTheme,
  schemaFiltresSecteurs,
  schemaIdSecteur,
  schemaIdTheme,
  schemaModificationSecteur,
  schemaModificationTheme,
} from "../validations/secteurs";

const MESSAGE_SECTEUR_INTROUVABLE = "Secteur introuvable.";
const MESSAGE_THEME_INTROUVABLE = "Thème introuvable.";

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

// GET /admin/secteurs?actif=true|false
export async function listerLesSecteurs(req: Request, res: Response): Promise<void> {
  if (!acteur(req)) return repondreNonConnecte(res);

  const filtres = schemaFiltresSecteurs.safeParse(req.query);
  if (!filtres.success) return repondreDonneesInvalides(res, filtres.error);

  const secteurs = await listerSecteurs(filtres.data);
  res.status(200).json({ secteurs });
}

// GET /admin/secteurs/:id
export async function lireUnSecteur(req: Request, res: Response): Promise<void> {
  if (!acteur(req)) return repondreNonConnecte(res);

  const identifiant = schemaIdSecteur.safeParse(req.params);
  if (!identifiant.success) return repondreDonneesInvalides(res, identifiant.error);

  const secteur = await lireSecteur(identifiant.data.id);
  if (!secteur) return repondreNonTrouve(res, MESSAGE_SECTEUR_INTROUVABLE);

  res.status(200).json({ secteur });
}

// POST /admin/secteurs
export async function creerUnSecteur(req: Request, res: Response): Promise<void> {
  const qui = acteur(req);
  if (!qui) return repondreNonConnecte(res);

  const lecture = schemaCreationSecteur.safeParse(req.body);
  if (!lecture.success) return repondreDonneesInvalides(res, lecture.error);

  const resultat = await creerSecteur(qui, lecture.data);
  if (resultat.etat === "code_deja_utilise") {
    return repondreErreur(res, 409, "CODE_DEJA_UTILISE", "Ce code de secteur est déjà utilisé.");
  }

  res.status(201).json({ secteur: resultat.secteur });
}

// PATCH /admin/secteurs/:id
export async function modifierUnSecteur(req: Request, res: Response): Promise<void> {
  const qui = acteur(req);
  if (!qui) return repondreNonConnecte(res);

  const identifiant = schemaIdSecteur.safeParse(req.params);
  if (!identifiant.success) return repondreDonneesInvalides(res, identifiant.error);
  const lecture = schemaModificationSecteur.safeParse(req.body);
  if (!lecture.success) return repondreDonneesInvalides(res, lecture.error);

  const secteur = await modifierSecteur(qui, identifiant.data.id, lecture.data);
  if (!secteur) return repondreNonTrouve(res, MESSAGE_SECTEUR_INTROUVABLE);

  res.status(200).json({ secteur });
}

// POST /admin/secteurs/:id/themes
export async function creerUnTheme(req: Request, res: Response): Promise<void> {
  const qui = acteur(req);
  if (!qui) return repondreNonConnecte(res);

  const identifiant = schemaIdSecteur.safeParse(req.params);
  if (!identifiant.success) return repondreDonneesInvalides(res, identifiant.error);
  const lecture = schemaCreationTheme.safeParse(req.body);
  if (!lecture.success) return repondreDonneesInvalides(res, lecture.error);

  const resultat = await creerTheme(qui, identifiant.data.id, lecture.data);
  if (resultat.etat === "secteur_introuvable") {
    return repondreNonTrouve(res, MESSAGE_SECTEUR_INTROUVABLE);
  }
  if (resultat.etat === "code_deja_utilise") {
    return repondreErreur(
      res,
      409,
      "CODE_DEJA_UTILISE",
      "Ce code de thème est déjà utilisé dans ce secteur.",
    );
  }

  res.status(201).json({ theme: resultat.theme });
}

// PATCH /admin/secteurs/:id/themes/:themeId
export async function modifierUnTheme(req: Request, res: Response): Promise<void> {
  const qui = acteur(req);
  if (!qui) return repondreNonConnecte(res);

  const identifiants = schemaIdTheme.safeParse(req.params);
  if (!identifiants.success) return repondreDonneesInvalides(res, identifiants.error);
  const lecture = schemaModificationTheme.safeParse(req.body);
  if (!lecture.success) return repondreDonneesInvalides(res, lecture.error);

  const theme = await modifierTheme(qui, identifiants.data.id, identifiants.data.themeId, lecture.data);
  if (!theme) return repondreNonTrouve(res, MESSAGE_THEME_INTROUVABLE);

  res.status(200).json({ theme });
}

// GET /admin/secteurs/:id/questionnaires-types (lecture seule)
export async function listerLesQuestionnairesTypes(req: Request, res: Response): Promise<void> {
  if (!acteur(req)) return repondreNonConnecte(res);

  const identifiant = schemaIdSecteur.safeParse(req.params);
  if (!identifiant.success) return repondreDonneesInvalides(res, identifiant.error);

  const questionnaires = await listerQuestionnairesTypes(identifiant.data.id);
  if (!questionnaires) return repondreNonTrouve(res, MESSAGE_SECTEUR_INTROUVABLE);

  res.status(200).json({ questionnaires_types: questionnaires });
}