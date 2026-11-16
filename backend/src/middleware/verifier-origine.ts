import type { NextFunction, Request, Response } from "express";
import { NOM_COOKIE_SESSION } from "../modules/authentification/services/sessions";

// Protection CSRF : une requete qui modifie des donnees (POST, PUT, PATCH, DELETE) et qui porte
// le cookie de session ne passe que si son en-tete Origin est connu.
// - Sans cookie de session : rien a proteger, la requete passe (avis public, connexion...).
// - Sans en-tete Origin (Thunder Client, curl, tests) : la requete passe. Un navigateur envoie
//   toujours Origin sur une requete venue d'un autre site, donc une attaque est vue.
// - Origine connue : elle est dans ORIGINES_AUTORISEES, ou elle a le meme hote que la requete.
// A placer apres cookieParser, avant les routes.
const METHODES_SANS_EFFET = new Set(["GET", "HEAD", "OPTIONS"]);

function normaliser(adresse: string): string {
  try {
    return new URL(adresse).origin.toLowerCase();
  } catch {
    return adresse.trim().replace(/\/+$/, "").toLowerCase();
  }
}

function originesAutorisees(): Set<string> {
  const brut = process.env["ORIGINES_AUTORISEES"] ?? "";
  return new Set(
    brut
      .split(",")
      .map((origine) => origine.trim())
      .filter((origine) => origine !== "")
      .map(normaliser),
  );
}

function origineConnue(req: Request, origine: string): boolean {
  if (originesAutorisees().has(normaliser(origine))) {
    return true;
  }
  // Meme site : l'hote de l'origine est celui de la requete (tunnel, Nginx, proxy de developpement)
  try {
    return new URL(origine).host.toLowerCase() === (req.get("host") ?? "").toLowerCase();
  } catch {
    return false;
  }
}

export function verifierOrigine(req: Request, res: Response, next: NextFunction): void {
  if (METHODES_SANS_EFFET.has(req.method)) {
    next();
    return;
  }

  const jeton: unknown = req.cookies?.[NOM_COOKIE_SESSION];
  if (typeof jeton !== "string" || jeton === "") {
    next();
    return;
  }

  const origine = req.get("origin");
  if (origine === undefined || origineConnue(req, origine)) {
    next();
    return;
  }

  res.status(403).json({
    code: "ORIGINE_REFUSEE",
    message: "Cette requete vient d'une origine non autorisee.",
    details: null,
  });
}