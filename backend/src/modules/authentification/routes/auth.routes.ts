import { Router } from "express";
import { limiteConnexion } from "../../../middleware/limite-connexion";
import {
  limiteDemandeReinitialisation,
  limiteReinitialisation,
} from "../../../middleware/limite-reinitialisation";
import { connexion, deconnexion, moi } from "../controleurs/auth.controleur";
import {
  demanderReinitialisation,
  reinitialiser,
} from "../controleurs/reinitialisation.controleur";

export const routesAuthentification = Router();

routesAuthentification.post("/login", limiteConnexion, connexion);
routesAuthentification.post("/logout", deconnexion);
routesAuthentification.get("/me", moi);
routesAuthentification.post("/forgot-password", limiteDemandeReinitialisation, demanderReinitialisation);
routesAuthentification.post("/reset-password", limiteReinitialisation, reinitialiser);