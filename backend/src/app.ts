import "dotenv/config";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { routesAuthentification } from "./modules/authentification/routes/auth.routes";
import { routesSites } from "./modules/sites/routes/sites.routes";
import { routesPointsContact } from "./modules/points-de-contact/routes/points-contact.routes";
import { routesQuestionnaires } from "./modules/questionnaires/routes/questionnaires.routes";
import { routesAvisPublic } from "./modules/avis-public/routes/avis-public.routes";

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

app.get("/", (_req, res) => {
  res.send("<h1>Plateforme d'avis clients</h1><p>Le serveur fonctionne.</p>");
});

app.get("/api/v1/sante", (_req, res) => {
  res.json({ statut: "ok" });
});

app.use("/api/v1/auth", routesAuthentification);
app.use("/api/v1/sites", routesSites);
app.use("/api/v1/points-contact", routesPointsContact);
app.use("/api/v1/questionnaires", routesQuestionnaires);
app.use("/api/v1/public", routesAvisPublic);

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