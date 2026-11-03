import { Router } from "express";
import { exigerConnexion } from "../../../middleware/exiger-connexion";
import { exigerOrganisation } from "../../../middleware/exiger-organisation";
import { exigerRole } from "../../../middleware/exiger-role";
import { lireLesParametres, modifierLesParametres } from "../controleurs/parametres.controleur";

export const routesParametres = Router();

// Toutes les routes : connecte + une organisation associee au compte.
routesParametres.use(exigerConnexion, exigerOrganisation);

// Les parametres de l'organisation (seuils d'alerte, couleur) : reserves au Responsable.
routesParametres.get("/parametres", exigerRole("RESPONSABLE"), lireLesParametres);
routesParametres.patch("/parametres", exigerRole("RESPONSABLE"), modifierLesParametres);