import { Router } from "express";
import { exigerConnexion } from "../../../middleware/exiger-connexion";
import { exigerOrganisation } from "../../../middleware/exiger-organisation";
import { exigerRole } from "../../../middleware/exiger-role";
import { lireLesKpis } from "../controleurs/kpis.controleur";
import {
  lireLaSerie,
  lireLeClassement,
  lireLesDerniersAvis,
  lireLesQuestions,
  lireLesThemes,
} from "../controleurs/graphiques.controleur";

export const routesDashboard = Router();

// Toutes les routes : connecte + une organisation associee au compte.
routesDashboard.use(exigerConnexion, exigerOrganisation);

routesDashboard.get("/kpis", exigerRole("RESPONSABLE", "GESTIONNAIRE"), lireLesKpis);
routesDashboard.get("/themes", exigerRole("RESPONSABLE", "GESTIONNAIRE"), lireLesThemes);
routesDashboard.get("/timeseries", exigerRole("RESPONSABLE", "GESTIONNAIRE"), lireLaSerie);
routesDashboard.get("/ranking", exigerRole("RESPONSABLE", "GESTIONNAIRE"), lireLeClassement);
routesDashboard.get("/questions", exigerRole("RESPONSABLE", "GESTIONNAIRE"), lireLesQuestions);
routesDashboard.get("/derniers-avis", exigerRole("RESPONSABLE", "GESTIONNAIRE"), lireLesDerniersAvis);