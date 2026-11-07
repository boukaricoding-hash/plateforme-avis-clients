import { Router } from "express";
import { exigerConnexion } from "../../../middleware/exiger-connexion";
import { exigerOrganisation } from "../../../middleware/exiger-organisation";
import { exigerRole } from "../../../middleware/exiger-role";
import {
  activerUnUtilisateur,
  desactiverUnUtilisateur,
  inviterUnUtilisateur,
  listerLesUtilisateurs,
  modifierUnUtilisateur,
} from "../controleurs/utilisateurs.controleur";

export const routesUtilisateurs = Router();

// Toutes les routes : connecte + une organisation associee au compte.
routesUtilisateurs.use(exigerConnexion, exigerOrganisation);

// La gestion des utilisateurs est reservee au Responsable (le Gestionnaire n'a aucun acces).
routesUtilisateurs.get("/", exigerRole("RESPONSABLE"), listerLesUtilisateurs);
routesUtilisateurs.post("/inviter", exigerRole("RESPONSABLE"), inviterUnUtilisateur);
routesUtilisateurs.patch("/:id", exigerRole("RESPONSABLE"), modifierUnUtilisateur);
routesUtilisateurs.post("/:id/desactiver", exigerRole("RESPONSABLE"), desactiverUnUtilisateur);
routesUtilisateurs.post("/:id/activer", exigerRole("RESPONSABLE"), activerUnUtilisateur);