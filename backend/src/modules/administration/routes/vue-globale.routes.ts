import { Router } from "express";
import { exigerConnexion } from "../../../middleware/exiger-connexion";
import { exigerRole } from "../../../middleware/exiger-role";
import { lireLaVueGlobale } from "../controleurs/vue-globale.controleur";

export const routesAdminVueGlobale = Router();

// Toutes les routes : connecte + role Administrateur DTS.
// Pas d'exigerOrganisation : le compte de l'administrateur DTS n'est rattache a aucune organisation.
routesAdminVueGlobale.use(exigerConnexion, exigerRole("ADMINISTRATEUR"));

// Lecture seule : la vue globale ne se modifie jamais depuis l'API.
routesAdminVueGlobale.get("/", lireLaVueGlobale);