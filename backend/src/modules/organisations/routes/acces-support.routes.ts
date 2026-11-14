import { Router } from "express";
import { exigerConnexion } from "../../../middleware/exiger-connexion";
import { exigerOrganisation } from "../../../middleware/exiger-organisation";
import { exigerRole } from "../../../middleware/exiger-role";
import {
  accorderLAccesSupport,
  lireLAccesSupport,
  retirerLAccesSupport,
} from "../controleurs/acces-support.controleur";

export const routesAccesSupport = Router();

// Toutes les routes : connecte + une organisation associee au compte.
routesAccesSupport.use(exigerConnexion, exigerOrganisation);

// L'accord de support (autoriser DTS a lire les donnees, pour une duree limitee) : reserve au Responsable.
// GET : accord actif ou null. POST : donner l'accord (remplace l'accord actif). DELETE : le retirer.
routesAccesSupport.get("/acces-support", exigerRole("RESPONSABLE"), lireLAccesSupport);
routesAccesSupport.post("/acces-support", exigerRole("RESPONSABLE"), accorderLAccesSupport);
routesAccesSupport.delete("/acces-support", exigerRole("RESPONSABLE"), retirerLAccesSupport);