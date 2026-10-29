import { Router } from "express";
import { exigerConnexion } from "../../../middleware/exiger-connexion";
import { exigerOrganisation } from "../../../middleware/exiger-organisation";
import { exigerRole } from "../../../middleware/exiger-role";
import {
  lireLesStatistiquesQr,
  revoquerUnQr,
  telechargerLaPlanche,
  telechargerLeQr,
} from "../controleurs/qr-codes.controleur";

// Ce routeur est monte sur /api/v1/points-contact (voir app.ts), a cote des routes
// existantes des points de contact.
export const routesQrCodes = Router();

// Toutes les routes : connecte + une organisation associee au compte.
routesQrCodes.use(exigerConnexion, exigerOrganisation);

// Lecture : le Gestionnaire n'atteint que les points de ses sites (le controleur applique le perimetre).
routesQrCodes.get("/planche", exigerRole("RESPONSABLE", "GESTIONNAIRE"), telechargerLaPlanche);
routesQrCodes.get("/statistiques-qr", exigerRole("RESPONSABLE", "GESTIONNAIRE"), lireLesStatistiquesQr);
routesQrCodes.get("/:id/qr", exigerRole("RESPONSABLE", "GESTIONNAIRE"), telechargerLeQr);

// Revoquer ou regenerer : reserve au Responsable, comme la creation et la modification.
routesQrCodes.post("/:id/revoquer", exigerRole("RESPONSABLE"), revoquerUnQr);