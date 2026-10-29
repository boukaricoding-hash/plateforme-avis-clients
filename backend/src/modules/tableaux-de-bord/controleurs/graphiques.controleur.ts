import type { Request, Response } from "express";
import { sitesAutorises } from "../../../utilitaires/perimetre";
import { repondreDonneesInvalides } from "../../../utilitaires/reponses";
import { listerAvis } from "../../avis/services/avis";
import { calculerClassement } from "../services/classement";
import type { PorteeDashboard } from "../services/indicateurs";
import { calculerDetailQuestions } from "../services/questions";
import { calculerSerieTemporelle } from "../services/serie-temporelle";
import { calculerScoresThemes } from "../services/themes";
import {
  resoudrePeriode,
  schemaFiltresDashboard,
  type PeriodeDashboard,
} from "../validations/dashboard";

// Les graphiques du tableau de bord (jour 7, etape 4d) :
// GET /dashboard/themes, /timeseries, /ranking, /questions, /derniers-avis
// Tous lisent les memes filtres que /dashboard/kpis :
// ?from=2026-11-01&to=2026-11-30&site=...&point=...&questionnaire=...
// Sans from ni to : les 30 derniers jours.

const UN_JOUR_EN_MS = 24 * 60 * 60 * 1000;
const NOMBRE_DERNIERS_AVIS = 10;

type Preparation = {
  organisationId: string;
  perimetre: string[] | null;
  portee: PorteeDashboard;
  periode: PeriodeDashboard;
};

function jourTexte(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// La periode, telle que la voit le client ("AAAA-MM-JJ", derniere journee comprise).
function periodeTexte(periode: PeriodeDashboard) {
  return {
    from: jourTexte(periode.debut),
    to: jourTexte(new Date(periode.fin.getTime() - UN_JOUR_EN_MS)),
    nombre_jours: periode.nombre_jours,
  };
}

// Verifie la connexion et les filtres, calcule le perimetre et la periode.
// Renvoie null apres avoir deja repondu a l'erreur.
async function preparer(req: Request, res: Response): Promise<Preparation | null> {
  // Les controles d'acces ont deja rempli ces deux valeurs ; on verifie quand meme.
  const utilisateur = req.utilisateur;
  const organisationId = req.organisationId;
  if (!utilisateur || !organisationId) {
    res.status(401).json({ code: "NON_CONNECTE", message: "Vous n'etes pas connecte.", details: null });
    return null;
  }

  const lecture = schemaFiltresDashboard.safeParse(req.query);
  if (!lecture.success) {
    repondreDonneesInvalides(res, lecture.error);
    return null;
  }
  const filtres = lecture.data;

  const perimetre = await sitesAutorises(utilisateur);
  return {
    organisationId,
    perimetre,
    portee: { organisationId, perimetre, filtres },
    periode: resoudrePeriode(filtres),
  };
}

// GET /api/v1/dashboard/themes
export async function lireLesThemes(req: Request, res: Response): Promise<void> {
  const prep = await preparer(req, res);
  if (!prep) return;

  const themes = await calculerScoresThemes(prep.portee, prep.periode.debut, prep.periode.fin);
  res.status(200).json({ periode: periodeTexte(prep.periode), themes });
}

// GET /api/v1/dashboard/timeseries
export async function lireLaSerie(req: Request, res: Response): Promise<void> {
  const prep = await preparer(req, res);
  if (!prep) return;

  const points = await calculerSerieTemporelle(prep.portee, prep.periode.debut, prep.periode.fin);
  res.status(200).json({ periode: periodeTexte(prep.periode), points });
}

// GET /api/v1/dashboard/ranking
export async function lireLeClassement(req: Request, res: Response): Promise<void> {
  const prep = await preparer(req, res);
  if (!prep) return;

  const pointsContact = await calculerClassement(prep.portee, prep.periode.debut, prep.periode.fin);
  res.status(200).json({ periode: periodeTexte(prep.periode), points_contact: pointsContact });
}

// GET /api/v1/dashboard/questions
export async function lireLesQuestions(req: Request, res: Response): Promise<void> {
  const prep = await preparer(req, res);
  if (!prep) return;

  const questions = await calculerDetailQuestions(prep.portee, prep.periode.debut, prep.periode.fin);
  res.status(200).json({ periode: periodeTexte(prep.periode), questions });
}

// GET /api/v1/dashboard/derniers-avis
// Les 10 derniers avis de la periode, au meme format que la liste des avis (GET /avis).
export async function lireLesDerniersAvis(req: Request, res: Response): Promise<void> {
  const prep = await preparer(req, res);
  if (!prep) return;

  const periode = periodeTexte(prep.periode);
  const resultat = await listerAvis(prep.organisationId, prep.perimetre, {
    from: periode.from,
    to: periode.to,
    site: prep.portee.filtres.site,
    point: prep.portee.filtres.point,
    questionnaire: prep.portee.filtres.questionnaire,
    tri: "soumis_le",
    ordre: "desc",
    page: 1,
    limite: NOMBRE_DERNIERS_AVIS,
  });

  res.status(200).json({ periode, avis: resultat.avis });
}