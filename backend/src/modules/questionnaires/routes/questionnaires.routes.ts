import { Router } from "express";
import { exigerConnexion } from "../../../middleware/exiger-connexion";
import { exigerOrganisation } from "../../../middleware/exiger-organisation";
import { exigerRole } from "../../../middleware/exiger-role";
import {
  activerUnQuestionnaire,
  associerLesPointsContact,
  creerUnQuestionnaire,
  desactiverUnQuestionnaire,
  dupliquerUnQuestionnaire,
  lireUnQuestionnaire,
  listerLesQuestionnaires,
  modifierLesDatesDuQuestionnaire,
  modifierUnQuestionnaire,
  publierUnQuestionnaire,
} from "../controleurs/questionnaires.controleur";

export const routesQuestionnaires = Router();

// Toutes les routes : connecte + une organisation associee au compte.
routesQuestionnaires.use(exigerConnexion, exigerOrganisation);

routesQuestionnaires.get("/", exigerRole("RESPONSABLE", "GESTIONNAIRE"), listerLesQuestionnaires);
routesQuestionnaires.post("/", exigerRole("RESPONSABLE"), creerUnQuestionnaire);
routesQuestionnaires.get("/:id", exigerRole("RESPONSABLE", "GESTIONNAIRE"), lireUnQuestionnaire);
routesQuestionnaires.put("/:id", exigerRole("RESPONSABLE"), modifierUnQuestionnaire);
routesQuestionnaires.put("/:id/dates", exigerRole("RESPONSABLE"), modifierLesDatesDuQuestionnaire);
routesQuestionnaires.put(
  "/:id/points-contact",
  exigerRole("RESPONSABLE"),
  associerLesPointsContact,
);
routesQuestionnaires.post("/:id/publier", exigerRole("RESPONSABLE"), publierUnQuestionnaire);
routesQuestionnaires.post("/:id/dupliquer", exigerRole("RESPONSABLE"), dupliquerUnQuestionnaire);
routesQuestionnaires.post("/:id/activer", exigerRole("RESPONSABLE"), activerUnQuestionnaire);
routesQuestionnaires.post("/:id/desactiver", exigerRole("RESPONSABLE"), desactiverUnQuestionnaire);