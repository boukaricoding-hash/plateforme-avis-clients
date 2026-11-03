import { Router } from "express";
import { exigerConnexion } from "../../../middleware/exiger-connexion";
import { exigerOrganisation } from "../../../middleware/exiger-organisation";
import { exigerRole } from "../../../middleware/exiger-role";
import {
  lireMesPreferences,
  listerMesNotifications,
  marquerUneNotificationLue,
  modifierMesPreferences,
} from "../controleurs/notifications.controleur";

export const routesNotifications = Router();

// Toutes les routes : connecte + une organisation associee au compte.
routesNotifications.use(exigerConnexion, exigerOrganisation);

routesNotifications.get("/", exigerRole("RESPONSABLE", "GESTIONNAIRE"), listerMesNotifications);
routesNotifications.post("/:id/lue", exigerRole("RESPONSABLE", "GESTIONNAIRE"), marquerUneNotificationLue);

// Preferences de notification de l'utilisateur connecte (alertes groupees ou immediates).
routesNotifications.get("/preferences", exigerRole("RESPONSABLE", "GESTIONNAIRE"), lireMesPreferences);
routesNotifications.patch("/preferences", exigerRole("RESPONSABLE", "GESTIONNAIRE"), modifierMesPreferences);