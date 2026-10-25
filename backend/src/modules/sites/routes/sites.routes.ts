import { Router } from "express";
import { exigerConnexion } from "../../../middleware/exiger-connexion";
import { exigerOrganisation } from "../../../middleware/exiger-organisation";
import { exigerRole } from "../../../middleware/exiger-role";
import {
  creerUnSite,
  desactiverUnSite,
  listerLesSites,
  modifierUnSite,
} from "../controleurs/sites.controleur";

export const routesSites = Router();

// Toutes les routes : connecte + une organisation associee au compte.
routesSites.use(exigerConnexion, exigerOrganisation);

routesSites.get("/", exigerRole("RESPONSABLE", "GESTIONNAIRE"), listerLesSites);
routesSites.post("/", exigerRole("RESPONSABLE"), creerUnSite);
routesSites.patch("/:id", exigerRole("RESPONSABLE"), modifierUnSite);
routesSites.post("/:id/desactiver", exigerRole("RESPONSABLE"), desactiverUnSite);