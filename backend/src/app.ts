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
import { routesDashboard } from "./modules/tableaux-de-bord/routes/dashboard.routes";

export const app = express();

const originesAutorisees = (process.env["ORIGINES_AUTORISEES"] ?? "")
  .split(",")
  .map((origine) => origine.trim())
  .filter((origine) => origine !== "");

app.use(helmet());
app.use(
  cors({
    origin: originesAutorisees,
    credentials: true,
  }),
);

app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

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