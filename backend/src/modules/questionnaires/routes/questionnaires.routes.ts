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
  listerLesThemes,
  listerLesVersions,
  modifierLesDatesDuQuestionnaire,
  modifierUnQuestionnaire,
  publierUnQuestionnaire,
  supprimerUnQuestionnaire,
} from "../controleurs/questionnaires.controleur";

export const routesQuestionnaires = Router();

// Toutes les routes : connecte + une organisation associee au compte.
routesQuestionnaires.use(exigerConnexion, exigerOrganisation);

routesQuestionnaires.get("/", exigerRole("RESPONSABLE", "GESTIONNAIRE"), listerLesQuestionnaires);
routesQuestionnaires.post("/", exigerRole("RESPONSABLE"), creerUnQuestionnaire);
// Les routes des modeles AVANT /:id, sinon "modeles" serait lu comme un identifiant.
routesQuestionnaires.get("/modeles", exigerRole("RESPONSABLE", "GESTIONNAIRE"), listerLesModeles);
routesQuestionnaires.post("/modeles/:id/cloner", exigerRole("RESPONSABLE"), clonerUnModele);
// Themes du secteur (jour 19) : AVANT /:id, comme les modeles.
routesQuestionnaires.get("/themes", exigerRole("RESPONSABLE"), listerLesThemes);

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
// Historique des versions (jour 20) : Responsable seulement (les nombres d'avis couvrent toute l'organisation).
routesQuestionnaires.get("/:id/versions", exigerRole("RESPONSABLE"), listerLesVersions);
// Suppression (jour 20) : refusee s'il y a deja des avis (le questionnaire se desactive alors).
routesQuestionnaires.delete("/:id", exigerRole("RESPONSABLE"), supprimerUnQuestionnaire);