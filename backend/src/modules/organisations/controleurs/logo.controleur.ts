import type { Request, Response } from "express";
import multer from "multer";
import { repondreNonTrouve } from "../../../utilitaires/reponses";
import { enregistrerLogo, supprimerLogo, TAILLE_MAX_LOGO } from "../services/logo";

// Reception du fichier : en memoire (1 Mo au plus), un seul fichier, aucun autre champ.
// Le fichier n'est ecrit sur le disque par le service qu'apres verification de son contenu.
const recevoirFichier = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: TAILLE_MAX_LOGO, files: 1, fields: 0 },
}).single("logo");

// Les controles d'acces ont deja rempli ces deux valeurs ; on verifie quand meme.
function contexte(req: Request) {
  const utilisateur = req.utilisateur;
  const organisationId = req.organisationId;
  return utilisateur && organisationId ? { utilisateur, organisationId } : null;
}

function repondreNonConnecte(res: Response): void {
  res.status(401).json({ code: "NON_CONNECTE", message: "Vous n'êtes pas connecté.", details: null });
}

function repondreLogoInvalide(res: Response, code: string, message: string): void {
  res.status(400).json({ code, message, details: null });
}

// Lit le fichier envoye. Renvoie false (et repond) si la reception a echoue.
function lireEnvoi(req: Request, res: Response): Promise<boolean> {
  return new Promise((resolve, reject) => {
    recevoirFichier(req, res, (erreur: unknown) => {
      if (erreur === undefined || erreur === null) {
        resolve(true);
        return;
      }
      if (erreur instanceof multer.MulterError) {
        if (erreur.code === "LIMIT_FILE_SIZE") {
          repondreLogoInvalide(res, "LOGO_TROP_VOLUMINEUX", "Le logo est trop volumineux : 1 Mo au maximum.");
        } else {
          repondreLogoInvalide(res, "LOGO_INVALIDE", "Envoyez un seul fichier, dans le champ « logo ».");
        }
        resolve(false);
        return;
      }
      // Autre erreur : elle remonte au gestionnaire d'erreurs du serveur (reponse 500 generique).
      reject(erreur);
    });
  });
}

// POST /api/v1/organisation/logo (envoi d'un fichier dans le champ "logo")
export async function envoyerLogo(req: Request, res: Response): Promise<void> {
  const ctx = contexte(req);
  if (!ctx) return repondreNonConnecte(res);

  const recu = await lireEnvoi(req, res);
  if (!recu) return;

  if (req.file === undefined) {
    return repondreLogoInvalide(res, "LOGO_MANQUANT", "Aucun fichier reçu. Envoyez un fichier dans le champ « logo ».");
  }

  const resultat = await enregistrerLogo({
    organisationId: ctx.organisationId,
    utilisateurId: ctx.utilisateur.id,
    ip: req.ip,
    contenu: req.file.buffer,
  });

  if (resultat.statut === "format_invalide") {
    return repondreLogoInvalide(res, "LOGO_FORMAT_INVALIDE", "Le logo doit être une image PNG, JPEG ou WebP de 1 Mo au maximum.");
  }
  if (resultat.statut === "organisation_introuvable") {
    return repondreNonTrouve(res, "Organisation introuvable.");
  }
  res.status(200).json({ logo_url: resultat.logo_url });
}

// DELETE /api/v1/organisation/logo
export async function retirerLogo(req: Request, res: Response): Promise<void> {
  const ctx = contexte(req);
  if (!ctx) return repondreNonConnecte(res);

  const resultat = await supprimerLogo({
    organisationId: ctx.organisationId,
    utilisateurId: ctx.utilisateur.id,
    ip: req.ip,
  });

  if (resultat.statut === "organisation_introuvable") {
    return repondreNonTrouve(res, "Organisation introuvable.");
  }
  res.status(200).json({ logo_url: null });
}