import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import {
  lireLeQuestionnairePublic,
  creerUnAvisPublic,
} from "../controleurs/avis-public.controleur";

export const routesAvisPublic = Router();

// Anti-robot : nombre d'envois d'avis par minute et par adresse IP.
// La limite est large pour ne pas bloquer plusieurs clients sur le meme Wi-Fi.
function limiteParMinute(): number {
  const valeur = Number(process.env["LIMITE_AVIS_PAR_MINUTE"]);
  return Number.isInteger(valeur) && valeur >= 1 ? valeur : 20;
}

const limiteEnvoiAvis = rateLimit({
  windowMs: 60 * 1000,
  limit: limiteParMinute(),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      code: "TROP_DE_REQUETES",
      message: "Trop de tentatives. Reessayez dans une minute.",
      details: null,
    });
  },
});

// Anti-robot : nombre de scans de QR (lecture du questionnaire) par minute et par adresse IP.
// Elle freine surtout un robot qui essaie des codes au hasard. Large aussi : un restaurant entier
// peut partager le meme Wi-Fi. La valeur est lue a chaque requete (utile pour les tests).
function limiteScanParMinute(): number {
  const valeur = Number(process.env["LIMITE_SCAN_PAR_MINUTE"]);
  return Number.isInteger(valeur) && valeur >= 1 ? valeur : 60;
}

const limiteScan = rateLimit({
  windowMs: 60 * 1000,
  limit: () => limiteScanParMinute(),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      code: "TROP_DE_REQUETES",
      message: "Trop de tentatives. Reessayez dans une minute.",
      details: null,
    });
  },
});

// Routes publiques : aucune connexion demandee.
routesAvisPublic.get("/q/:code", limiteScan, lireLeQuestionnairePublic);
routesAvisPublic.post("/q/:code/avis", limiteEnvoiAvis, creerUnAvisPublic);