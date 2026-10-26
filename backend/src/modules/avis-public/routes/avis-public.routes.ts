import { Router } from "express";
import {
  lireLeQuestionnairePublic,
  creerUnAvisPublic,
} from "../controleurs/avis-public.controleur";

export const routesAvisPublic = Router();

// Routes publiques : aucune connexion demandee.
routesAvisPublic.get("/q/:code", lireLeQuestionnairePublic);
routesAvisPublic.post("/q/:code/avis", creerUnAvisPublic);