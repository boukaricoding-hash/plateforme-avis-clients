import { Router } from "express";
import { exigerConnexion } from "../../../middleware/exiger-connexion";
import { exigerRole } from "../../../middleware/exiger-role";
import {
  creerUnSecteur,
  creerUnTheme,
  lireUnSecteur,
  listerLesQuestionnairesTypes,
  listerLesSecteurs,
  modifierUnSecteur,
  modifierUnTheme,
} from "../controleurs/secteurs.controleur";

export const routesAdminSecteurs = Router();

// Toutes les routes : connecte + role Administrateur DTS.
// Pas d'exigerOrganisation : le compte de l'administrateur DTS n'est rattache a aucune organisation.
routesAdminSecteurs.use(exigerConnexion, exigerRole("ADMINISTRATEUR"));

routesAdminSecteurs.get("/", listerLesSecteurs);
routesAdminSecteurs.post("/", creerUnSecteur);
routesAdminSecteurs.get("/:id", lireUnSecteur);
routesAdminSecteurs.patch("/:id", modifierUnSecteur);
routesAdminSecteurs.post("/:id/themes", creerUnTheme);
routesAdminSecteurs.patch("/:id/themes/:themeId", modifierUnTheme);
routesAdminSecteurs.get("/:id/questionnaires-types", listerLesQuestionnairesTypes);