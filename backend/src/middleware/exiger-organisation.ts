import type { NextFunction, Request, Response } from "express";

// Ajoute req.organisationId a Express. Cette valeur vient de la session,
// jamais du corps de la requete, de l'adresse ou des parametres.
declare global {
  namespace Express {
    interface Request {
      organisationId?: string;
    }
  }
}

// A placer apres exigerConnexion.
export function exigerOrganisation(req: Request, res: Response, next: NextFunction): void {
  const organisationId = req.utilisateur?.organisation_id;

  if (!organisationId) {
    res.status(403).json({
      code: "ACCES_REFUSE",
      message: "Aucune organisation n'est associee a ce compte.",
      details: null,
    });
    return;
  }

  req.organisationId = organisationId;
  next();
}