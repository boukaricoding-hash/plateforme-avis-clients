import { Router } from "express";
import { exigerConnexion } from "../../../middleware/exiger-connexion";
import { exigerRole } from "../../../middleware/exiger-role";
import { lireLeJournal } from "../controleurs/journal.controleur";

export const routesAdminJournal = Router();

// Toutes les routes : connecte + role Administrateur DTS.
// Pas d'exigerOrganisation : le compte de l'administrateur DTS n'est rattache a aucune organisation.
routesAdminJournal.use(exigerConnexion, exigerRole("ADMINISTRATEUR"));

// Lecture seule : le journal ne se modifie jamais depuis l'API.
routesAdminJournal.get("/", lireLeJournal);