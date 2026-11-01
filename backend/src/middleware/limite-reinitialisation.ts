import { rateLimit } from "express-rate-limit";

const FENETRE_MS = 15 * 60 * 1000;

// Lit un maximum dans l'environnement a chaque requete (utile pour les tests).
// Sans variable valide, on garde la valeur par defaut.
function lireMaximum(nomVariable: string, parDefaut: number): number {
  const valeur = Number(process.env[nomVariable]);
  return Number.isInteger(valeur) && valeur > 0 ? valeur : parDefaut;
}

function creerLimiteur(nomVariable: string, parDefaut: number) {
  return rateLimit({
    windowMs: FENETRE_MS,
    limit: () => lireMaximum(nomVariable, parDefaut),
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        code: "TROP_DE_REQUETES",
        message: "Trop de tentatives. Reessayez dans quelques minutes.",
        details: null,
      });
    },
  });
}

// Demande du lien : 5 demandes par IP toutes les 15 minutes.
export const limiteDemandeReinitialisation = creerLimiteur(
  "LIMITE_REINITIALISATION_DEMANDE_MAX",
  5,
);

// Choix du nouveau mot de passe : 10 essais par IP toutes les 15 minutes.
export const limiteReinitialisation = creerLimiteur("LIMITE_REINITIALISATION_MAX", 10);