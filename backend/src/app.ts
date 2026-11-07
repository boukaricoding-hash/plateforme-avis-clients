import "dotenv/config";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import fs from "node:fs";
import path from "node:path";
import { routesAuthentification } from "./modules/authentification/routes/auth.routes";
import { routesSites } from "./modules/sites/routes/sites.routes";
import { routesPointsContact } from "./modules/points-de-contact/routes/points-contact.routes";
import { routesQrCodes } from "./modules/qr-codes/routes/qr-codes.routes";
import { routesQuestionnaires } from "./modules/questionnaires/routes/questionnaires.routes";
import { routesAvisPublic } from "./modules/avis-public/routes/avis-public.routes";
import { routesAvis } from "./modules/avis/routes/avis.routes";
import { routesNotifications } from "./modules/notifications/routes/notifications.routes";
import { routesParametres } from "./modules/organisations/routes/parametres.routes";
import { dossierLogos } from "./modules/organisations/services/logo";
import { routesDashboard } from "./modules/tableaux-de-bord/routes/dashboard.routes";
import { routesUtilisateurs } from "./modules/utilisateurs/routes/utilisateurs.routes";
import { routesInvitations } from "./modules/utilisateurs/routes/invitations.routes";

export const app = express();
// Nombre d'intermediaires (tunnel, Nginx) entre le client et le serveur.
// 0 = aucun (en local). 1 = un intermediaire.
app.set("trust proxy", Number(process.env["NOMBRE_PROXYS"]) || 0);
const originesAutorisees = (process.env["ORIGINES_AUTORISEES"] ?? "")
  .split(",")
  .map((origine) => origine.trim())
  .filter((origine) => origine !== "");

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        // Autorise les logos d'organisations heberges ailleurs (en HTTPS).
        "img-src": ["'self'", "data:", "https:"],
      },
    },
  }),
);
app.use(
  cors({
    origin: originesAutorisees,
    credentials: true,
  }),
);

app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

// Tableau de bord des responsables : servi sous /tableau-de-bord quand le dossier existe (dans Docker).
// Toute adresse sous /tableau-de-bord renvoie sa page, par exemple /tableau-de-bord/avis/12 : c'est la page qui choisit l'ecran.
// Ce bloc doit rester avant celui de la page d'avis, qui repond a toutes les autres adresses.
const dossierTableau = path.join(process.cwd(), "tableau-de-bord");
if (fs.existsSync(dossierTableau)) {
  app.use("/tableau-de-bord", express.static(dossierTableau, { index: false }));
  app.use("/tableau-de-bord", (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "GET") {
      next();
      return;
    }
    // Un fichier absent (adresse avec extension) ne doit pas renvoyer la page : 404 simple.
    if (path.extname(req.path) !== "") {
      res.status(404).end();
      return;
    }
    res.sendFile(path.join(dossierTableau, "index.html"));
  });
}

// Page d'avis (version finale) : servie par le serveur quand le dossier "page" existe (dans Docker).
// Toute adresse hors /api renvoie la page, par exemple /q/ABC123 : c'est la page qui lit le code.
const dossierPage = path.join(process.cwd(), "page");
if (fs.existsSync(dossierPage)) {
  app.use(express.static(dossierPage, { index: false }));
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "GET" || req.path.startsWith("/api/")) {
      next();
      return;
    }
    res.sendFile(path.join(dossierPage, "index.html"));
  });
}

app.get("/", (_req, res) => {
  res.send("<h1>Plateforme d'avis clients</h1><p>Le serveur fonctionne.</p>");
});

app.get("/api/v1/sante", (_req, res) => {
  res.json({ statut: "ok" });
});

app.use("/api/v1/auth", routesAuthentification);
app.use("/api/v1/sites", routesSites);
app.use("/api/v1/points-contact", routesPointsContact);
// QR codes : meme adresse de base que les points de contact (/qr, /planche, /revoquer, /statistiques-qr)
app.use("/api/v1/points-contact", routesQrCodes);
app.use("/api/v1/questionnaires", routesQuestionnaires);
app.use("/api/v1/public", routesAvisPublic);
app.use("/api/v1/avis", routesAvis);
app.use("/api/v1/notifications", routesNotifications);
app.use("/api/v1/organisation", routesParametres);
app.use("/api/v1/utilisateurs", routesUtilisateurs);
// Invitations : routes publiques (verification du lien, acceptation)
app.use("/api/v1/invitations", routesInvitations);

// Logos des organisations : adresse publique (la page d'avis et les chevalets les affichent).
// Les noms de fichiers sont des identifiants aleatoires. Un logo absent donne le 404 JSON habituel.
app.use(
  "/api/v1/logos",
  express.static(dossierLogos(), { index: false, dotfiles: "ignore", maxAge: "30d", immutable: true }),
);
app.use("/api/v1/dashboard", routesDashboard);
// 404 : aucune route ne correspond
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    code: "NON_TROUVE",
    message: "Adresse introuvable.",
    details: null,
  });
});

// Erreur : requete mal formee (4xx) ou erreur inattendue (500)
app.use((erreur: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const statut =
    typeof erreur === "object" && erreur !== null && "status" in erreur && typeof erreur.status === "number"
      ? erreur.status
      : 500;

  if (statut >= 400 && statut < 500) {
    res.status(statut).json({
      code: "REQUETE_INVALIDE",
      message: "La requete est invalide.",
      details: null,
    });
    return;
  }

  // Le detail reste dans le terminal, jamais envoye au client
  console.error(erreur);
  res.status(500).json({
    code: "ERREUR_SERVEUR",
    message: "Une erreur est survenue.",
    details: null,
  });
});