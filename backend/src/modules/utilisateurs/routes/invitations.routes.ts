import { Router } from "express";
import {
  limiteAcceptationInvitation,
  limiteVerificationInvitation,
} from "../../../middleware/limite-invitations";
import { accepterLInvitation, verifierLeLien } from "../controleurs/invitations.controleur";

export const routesInvitations = Router();

// Routes publiques : l'invite n'a pas encore de compte, donc pas de connexion exigee.
// Seule la limite de requetes par IP protege ces deux routes.
routesInvitations.get("/verifier", limiteVerificationInvitation, verifierLeLien);
routesInvitations.post("/accepter", limiteAcceptationInvitation, accepterLInvitation);