import { Router } from "express";
import { connexion, deconnexion, moi } from "../controleurs/auth.controleur";

export const routesAuthentification = Router();

routesAuthentification.post("/login", connexion);
routesAuthentification.post("/logout", deconnexion);
routesAuthentification.get("/me", moi);