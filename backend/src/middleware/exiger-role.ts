import type { NextFunction, Request, Response } from "express";
import type { UtilisateurConnecte } from "./exiger-connexion";

type Role = UtilisateurConnecte["role"];

// Utilisation : router.use(exigerConnexion, exigerRole("ADMINISTRATEUR"))
export function exigerRole(...rolesAutorises: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const utilisateur = req.utilisateur;

    if (!utilisateur) {
      res.status(401).json({
        code: "NON_CONNECTE",
        message: "Vous n'etes pas connecte.",
        details: null,
      });
      return;
    }

    if (!rolesAutorises.includes(utilisateur.role)) {
      res.status(403).json({
        code: "ACCES_REFUSE",
        message: "Vous n'avez pas le droit d'effectuer cette action.",
        details: null,
      });
      return;
    }

    next();
  };
}