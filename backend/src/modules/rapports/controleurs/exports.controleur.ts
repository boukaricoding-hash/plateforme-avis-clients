import type { Request, Response } from "express";
import { sitesAutorises } from "../../../utilitaires/perimetre";
import { repondreDonneesInvalides } from "../../../utilitaires/reponses";
import { enregistrerAudit } from "../../journal-audit/services/journal";
import { lireOrganisationPourChevalet } from "../../qr-codes/services/qr-codes";
import type { PorteeDashboard } from "../../tableaux-de-bord/services/indicateurs";
import { resoudrePeriode } from "../../tableaux-de-bord/validations/dashboard";
import { analyserAvis, versContenuAnalyse } from "../services/analyse";
import { collecterAvis, LIMITE_AVIS_EXPORT } from "../services/collecte-avis";
import { genererCsv } from "../services/export-csv";
import { genererXlsx } from "../services/export-xlsx";
import { genererRapportPdf } from "../services/rapport-pdf";
import {
  schemaDemandeAnalyse,
  schemaDemandeExport,
  type DemandeExport,
  type FormatExport,
} from "../validations/exports";

// ------------------------------------------------------------
// Exports et analyse (jour 21)
// ------------------------------------------------------------
// POST /api/v1/exports          : renvoie le fichier (csv, xlsx ou pdf) a telecharger.
// POST /api/v1/exports/analyse  : renvoie l'analyse en JSON (c'est ce que lit le robot de l'ecran E16).
// - L'organisation et le perimetre viennent de la session, jamais du corps de la requete.
// - csv : les avis filtres. xlsx : les avis filtres + la feuille "Analyse". pdf : le rapport de synthese.
// - Chaque fichier genere laisse une ligne dans le journal d'audit (action EXPORT_GENERE).

const TYPES_MIME: Record<FormatExport, string> = {
  csv: "text/csv; charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
};

// Les controles d'acces ont deja rempli ces deux valeurs ; on verifie quand meme.
function contexte(req: Request) {
  const utilisateur = req.utilisateur;
  const organisationId = req.organisationId;
  return utilisateur && organisationId ? { utilisateur, organisationId } : null;
}

function repondreNonConnecte(res: Response): void {
  res.status(401).json({ code: "NON_CONNECTE", message: "Vous n'etes pas connecte.", details: null });
}

function repondreErreurServeur(res: Response, erreur: unknown): void {
  // Le detail reste dans le terminal, jamais envoye au client.
  console.error(erreur);
  res.status(500).json({ code: "ERREUR_SERVEUR", message: "Une erreur est survenue.", details: null });
}

function envoyerFichier(res: Response, contenu: Buffer, type: string, nom: string): void {
  res.setHeader("Content-Type", type);
  res.setHeader("Content-Disposition", 'attachment; filename="' + nom + '"');
  res.setHeader("Cache-Control", "no-store");
  res.status(200).send(contenu);
}

// "avis-2026-11-14.xlsx" ou "rapport-avis-2026-11-14.pdf" (jour UTC, Africa/Lome = UTC+0).
function nomDuFichier(format: FormatExport, maintenant: Date): string {
  const jour = maintenant.toISOString().slice(0, 10);
  return format === "pdf" ? "rapport-avis-" + jour + ".pdf" : "avis-" + jour + "." + format;
}

// La portee du tableau de bord : organisation et perimetre de la session, filtres de la demande.
function construirePortee(
  organisationId: string,
  perimetre: string[] | null,
  demande: DemandeExport,
): PorteeDashboard {
  return { organisationId, perimetre, filtres: demande.filtres };
}

// ------------------------------------------------------------
// POST /api/v1/exports
// ------------------------------------------------------------
export async function exporterLesAvis(req: Request, res: Response): Promise<void> {
  const ctx = contexte(req);
  if (!ctx) return repondreNonConnecte(res);

  const lecture = schemaDemandeExport.safeParse(req.body);
  if (!lecture.success) return repondreDonneesInvalides(res, lecture.error);
  const demande = lecture.data;
  const { format, langue, filtres } = demande;

  try {
    const maintenant = new Date();
    const perimetre = await sitesAutorises(ctx.utilisateur);
    const portee = construirePortee(ctx.organisationId, perimetre, demande);

    let contenu: Buffer;
    let nombreAvis: number;

    if (format === "pdf") {
      // Le rapport ne lit pas les avis un par un : il part de l'analyse (chiffres du tableau de bord).
      const analyse = await analyserAvis(portee, resoudrePeriode(filtres, maintenant), langue, maintenant);
      const organisation = await lireOrganisationPourChevalet(ctx.organisationId);
      contenu = await genererRapportPdf(analyse, {
        nomOrganisation: organisation.nom,
        couleur: organisation.couleur,
        logo: organisation.logo,
        genereLe: maintenant,
      });
      nombreAvis = analyse.nb_avis;
    } else {
      const collecte = await collecterAvis(ctx.organisationId, perimetre, filtres, langue);
      if (collecte.etat === "trop_volumineux") {
        res.status(422).json({
          code: "EXPORT_TROP_VOLUMINEUX",
          message:
            "Il y a " +
            collecte.total +
            " avis a exporter, le maximum est " +
            LIMITE_AVIS_EXPORT +
            ". Reduisez la periode ou ajoutez un filtre.",
          details: { total: collecte.total, limite: LIMITE_AVIS_EXPORT },
        });
        return;
      }

      if (format === "csv") {
        contenu = genererCsv(collecte, langue);
      } else {
        // Excel : la feuille "Analyse" suit la periode, le site, le point et le questionnaire demandes.
        const analyse = await analyserAvis(portee, resoudrePeriode(filtres, maintenant), langue, maintenant);
        contenu = await genererXlsx(collecte, langue, versContenuAnalyse(analyse));
      }
      nombreAvis = collecte.total;
    }

    // Journal d'audit : qui a exporte quoi. Jamais de texte de recherche ni de donnees de clients.
    await enregistrerAudit({
      action: "EXPORT_GENERE",
      utilisateurId: ctx.utilisateur.id,
      organisationId: ctx.organisationId,
      ip: req.ip,
      details: {
        format,
        langue,
        nb_avis: nombreAvis,
        from: filtres.from ?? null,
        to: filtres.to ?? null,
        site: filtres.site ?? null,
        point: filtres.point ?? null,
        questionnaire: filtres.questionnaire ?? null,
        statut: filtres.statut ?? null,
        negatifs: filtres.negatifs ?? null,
        avec_commentaire: filtres.avec_commentaire ?? null,
        note_min: filtres.note_min ?? null,
        note_max: filtres.note_max ?? null,
        recherche: filtres.q !== undefined,
      },
    });

    envoyerFichier(res, contenu, TYPES_MIME[format], nomDuFichier(format, maintenant));
  } catch (erreur) {
    repondreErreurServeur(res, erreur);
  }
}

// ------------------------------------------------------------
// POST /api/v1/exports/analyse
// ------------------------------------------------------------
// Le robot analyse les avis avant que l'utilisateur ait choisi son format : "format" est donc
// facultatif ici. On le force a "pdf" pour la validation, car l'analyse a la meme limite de
// periode que le rapport pdf (366 jours, comme le tableau de bord).
export async function analyserLesAvis(req: Request, res: Response): Promise<void> {
  const ctx = contexte(req);
  if (!ctx) return repondreNonConnecte(res);

  const corps: unknown = req.body;
  const base = typeof corps === "object" && corps !== null && !Array.isArray(corps) ? corps : {};
  const lecture = schemaDemandeAnalyse.safeParse({ ...base, format: "pdf" });
  if (!lecture.success) return repondreDonneesInvalides(res, lecture.error);
  const demande = lecture.data;

  try {
    const maintenant = new Date();
    const perimetre = await sitesAutorises(ctx.utilisateur);
    const portee = construirePortee(ctx.organisationId, perimetre, demande);
    const analyse = await analyserAvis(
      portee,
      resoudrePeriode(demande.filtres, maintenant),
      demande.langue,
      maintenant,
    );
    res.status(200).json(analyse);
  } catch (erreur) {
    repondreErreurServeur(res, erreur);
  }
}