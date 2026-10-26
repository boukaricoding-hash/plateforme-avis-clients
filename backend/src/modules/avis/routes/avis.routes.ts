import { Router } from "express";
import { exigerConnexion } from "../../../middleware/exiger-connexion";
import { exigerOrganisation } from "../../../middleware/exiger-organisation";
import { exigerRole } from "../../../middleware/exiger-role";
import { listerLesAvis, lireUnAvis } from "../controleurs/avis.controleur";

export const routesAvis = Router();

// Toutes les routes : connecte + une organisation associee au compte.
routesAvis.use(exigerConnexion, exigerOrganisation);

routesAvis.get("/", exigerRole("RESPONSABLE", "GESTIONNAIRE"), listerLesAvis);
routesAvis.get("/:id", exigerRole("RESPONSABLE", "GESTIONNAIRE"), lireUnAvis);