import { Router } from "express";
import { exigerConnexion } from "../../../middleware/exiger-connexion";
import { exigerOrganisation } from "../../../middleware/exiger-organisation";
import { exigerRole } from "../../../middleware/exiger-role";
import {
  creerPointsContactMasse,
  creerUnPointContact,
  desactiverUnPointContact,
  listerLesPointsContact,
  modifierUnPointContact,
} from "../controleurs/points-contact.controleur";

export const routesPointsContact = Router();

// Toutes les routes : connecte + une organisation associee au compte.
routesPointsContact.use(exigerConnexion, exigerOrganisation);

routesPointsContact.get("/", exigerRole("RESPONSABLE", "GESTIONNAIRE"), listerLesPointsContact);
routesPointsContact.post("/", exigerRole("RESPONSABLE"), creerUnPointContact);
routesPointsContact.post("/masse", exigerRole("RESPONSABLE"), creerPointsContactMasse);
routesPointsContact.patch("/:id", exigerRole("RESPONSABLE"), modifierUnPointContact);
routesPointsContact.post("/:id/desactiver", exigerRole("RESPONSABLE"), desactiverUnPointContact);