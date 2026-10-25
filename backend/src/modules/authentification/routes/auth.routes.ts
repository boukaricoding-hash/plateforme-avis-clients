import { Router } from "express";
import { connexion } from "../controleurs/auth.controleur";

export const routesAuthentification = Router();

routesAuthentification.post("/login", connexion);