import { Router } from "express";
import { exigerConnexion } from "../../../middleware/exiger-connexion";
import { exigerRole } from "../../../middleware/exiger-role";
import {
  creerUneOrganisation,
  inviterLePremierResponsable,
  lireUneOrganisation,
  listerLesOrganisations,
  modifierUneOrganisation,
  reactiverUneOrganisation,
  suspendreUneOrganisation,
} from "../controleurs/organisations.controleur";

export const routesAdminOrganisations = Router();

// Toutes les routes : connecte + role Administrateur DTS.
// Pas d'exigerOrganisation : le compte de l'administrateur DTS n'est rattache a aucune organisation.
routesAdminOrganisations.use(exigerConnexion, exigerRole("ADMINISTRATEUR"));

routesAdminOrganisations.get("/", listerLesOrganisations);
routesAdminOrganisations.post("/", creerUneOrganisation);
routesAdminOrganisations.get("/:id", lireUneOrganisation);
routesAdminOrganisations.patch("/:id", modifierUneOrganisation);
routesAdminOrganisations.post("/:id/suspendre", suspendreUneOrganisation);
routesAdminOrganisations.post("/:id/reactiver", reactiverUneOrganisation);
routesAdminOrganisations.post("/:id/inviter-responsable", inviterLePremierResponsable);