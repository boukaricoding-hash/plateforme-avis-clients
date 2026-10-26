import { Router } from "express";
import { exigerConnexion } from "../../../middleware/exiger-connexion";
import { exigerOrganisation } from "../../../middleware/exiger-organisation";
import { exigerRole } from "../../../middleware/exiger-role";
import {
  listerMesNotifications,
  marquerUneNotificationLue,
} from "../controleurs/notifications.controleur";

export const routesNotifications = Router();

// Toutes les routes : connecte + une organisation associee au compte.
routesNotifications.use(exigerConnexion, exigerOrganisation);

routesNotifications.get("/", exigerRole("RESPONSABLE", "GESTIONNAIRE"), listerMesNotifications);
routesNotifications.post("/:id/lue", exigerRole("RESPONSABLE", "GESTIONNAIRE"), marquerUneNotificationLue);