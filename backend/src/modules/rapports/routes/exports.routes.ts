import { Router } from "express";
import { exigerConnexion } from "../../../middleware/exiger-connexion";
import { exigerOrganisation } from "../../../middleware/exiger-organisation";
import { exigerRole } from "../../../middleware/exiger-role";
import { analyserLesAvis, exporterLesAvis } from "../controleurs/exports.controleur";

export const routesExports = Router();

// Toutes les routes : connecte + une organisation associee au compte.
routesExports.use(exigerConnexion, exigerOrganisation);

// POST /api/v1/exports : le fichier (csv, xlsx ou pdf)
routesExports.post("/", exigerRole("RESPONSABLE", "GESTIONNAIRE"), exporterLesAvis);
// POST /api/v1/exports/analyse : l'analyse en JSON pour le robot
routesExports.post("/analyse", exigerRole("RESPONSABLE", "GESTIONNAIRE"), analyserLesAvis);