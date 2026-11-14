import { Router } from "express";
import { exigerAccesSupport } from "../../../middleware/exiger-acces-support";
import { exigerConnexion } from "../../../middleware/exiger-connexion";
import { exigerRole } from "../../../middleware/exiger-role";
import {
  lireLaFicheSupport,
  lireLesIndicateursSupport,
  lireUnAvisSupport,
  listerLesAvisSupport,
  listerLesPointsContactSupport,
  listerLesSitesSupport,
  listerLesUtilisateursSupport,
} from "../controleurs/support.controleur";

export const routesAdminSupport = Router();

// Toutes les routes : connecte + role Administrateur DTS.
// Pas d'exigerOrganisation : le compte de l'administrateur DTS n'est rattache a aucune organisation.
routesAdminSupport.use(exigerConnexion, exigerRole("ADMINISTRATEUR"));

// Consultation de support : LECTURE SEULE. Il n'y a ici que des routes GET : aucune route
// POST, PATCH, PUT ni DELETE n'existe sous ce chemin (une telle requete donne 404).
// Chaque route verifie l'accord de l'organisation a chaque requete (exiger-acces-support),
// ecrit la consultation dans le journal avec la partie consultee, puis lit les donnees.
routesAdminSupport.get("/organisations/:id", exigerAccesSupport("fiche"), lireLaFicheSupport);
routesAdminSupport.get("/organisations/:id/indicateurs", exigerAccesSupport("indicateurs"), lireLesIndicateursSupport);
routesAdminSupport.get("/organisations/:id/avis", exigerAccesSupport("avis"), listerLesAvisSupport);
routesAdminSupport.get("/organisations/:id/avis/:avisId", exigerAccesSupport("avis"), lireUnAvisSupport);
routesAdminSupport.get("/organisations/:id/sites", exigerAccesSupport("sites"), listerLesSitesSupport);
routesAdminSupport.get(
  "/organisations/:id/points-contact",
  exigerAccesSupport("points-contact"),
  listerLesPointsContactSupport,
);
routesAdminSupport.get(
  "/organisations/:id/utilisateurs",
  exigerAccesSupport("utilisateurs"),
  listerLesUtilisateursSupport,
);