import { Router } from "express";
import { limiteConnexion } from "../../../middleware/limite-connexion";
import { connexion, deconnexion, moi } from "../controleurs/auth.controleur";

export const routesAuthentification = Router();

routesAuthentification.post("/login", limiteConnexion, connexion);
routesAuthentification.post("/logout", deconnexion);
routesAuthentification.get("/me", moi);