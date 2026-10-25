import { Router } from "express";
import { lireLeQuestionnairePublic } from "../controleurs/avis-public.controleur";

export const routesAvisPublic = Router();

// Routes publiques : aucune connexion demandee.
routesAvisPublic.get("/q/:code", lireLeQuestionnairePublic);