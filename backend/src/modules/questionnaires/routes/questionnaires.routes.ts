import { Router } from "express";
import { exigerConnexion } from "../../../middleware/exiger-connexion";
import { exigerOrganisation } from "../../../middleware/exiger-organisation";
import { exigerRole } from "../../../middleware/exiger-role";
import {
  activerUnQuestionnaire,
  associerLesPointsContact,
  clonerUnModele,
  creerUnQuestionnaire,
  desactiverUnQuestionnaire,
  dupliquerUnQuestionnaire,
  lireUnQuestionnaire,
  listerLesModeles,
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
// Les routes des modeles AVANT /:id, sinon "modeles" serait lu comme un identifiant.
routesQuestionnaires.get("/modeles", exigerRole("RESPONSABLE", "GESTIONNAIRE"), listerLesModeles);
routesQuestionnaires.post("/modeles/:id/cloner", exigerRole("RESPONSABLE"), clonerUnModele);

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