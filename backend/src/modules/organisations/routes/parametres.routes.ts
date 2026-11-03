import { Router } from "express";
import { exigerConnexion } from "../../../middleware/exiger-connexion";
import { exigerOrganisation } from "../../../middleware/exiger-organisation";
import { exigerRole } from "../../../middleware/exiger-role";
import { envoyerLogo, retirerLogo } from "../controleurs/logo.controleur";
import { lireLesParametres, modifierLesParametres } from "../controleurs/parametres.controleur";

export const routesParametres = Router();

// Toutes les routes : connecte + une organisation associee au compte.
routesParametres.use(exigerConnexion, exigerOrganisation);

// Les parametres de l'organisation (seuils d'alerte, couleur) : reserves au Responsable.
routesParametres.get("/parametres", exigerRole("RESPONSABLE"), lireLesParametres);
routesParametres.patch("/parametres", exigerRole("RESPONSABLE"), modifierLesParametres);

// Le logo de l'organisation : reserve au Responsable.
// POST : envoi d'un fichier PNG, JPEG ou WebP (champ "logo", 1 Mo au plus).
// DELETE : retrait du logo.
routesParametres.post("/logo", exigerRole("RESPONSABLE"), envoyerLogo);
routesParametres.delete("/logo", exigerRole("RESPONSABLE"), retirerLogo);