import type { Request, Response } from "express";
import { sitesAutorises } from "../../../utilitaires/perimetre";
import { repondreDonneesInvalides, repondreNonTrouve } from "../../../utilitaires/reponses";
import {
  schemaFiltrePointsContact,
  schemaIdPointContact,
} from "../../points-de-contact/validations/point-contact";
import { genererChevaletPdf, genererPlancheA4Pdf } from "../services/chevalet";
import { adresseDuQr, genererQrPng, genererQrSvg } from "../services/qr";
import {
  LIMITE_PLANCHE,
  lireOrganisationPourChevalet,
  lirePointPourQr,
  listerPointsPourPlanche,
  revoquerQr,
  statistiquesParQr,
} from "../services/qr-codes";
import { schemaRevocationQr, schemaTelechargementQr } from "../validations/qr-codes";

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

// "Table 12" -> "table-12" : un nom de fichier sans accent ni espace.
function nomDeFichier(texte: string): string {
  const propre = texte
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return propre === "" ? "qr" : propre;
}

function envoyerFichier(res: Response, contenu: Buffer | string, type: string, nom: string): void {
  res.setHeader("Content-Type", type);
  res.setHeader("Content-Disposition", 'attachment; filename="' + nom + '"');
  res.setHeader("Cache-Control", "no-store");
  res.status(200).send(contenu);
}

// GET /points-contact/:id/qr?format=png|svg|pdf&taille=A6|A5&largeur=1024
export async function telechargerLeQr(req: Request, res: Response): Promise<void> {
  const ctx = contexte(req);
  if (!ctx) return repondreNonConnecte(res);

  const identifiant = schemaIdPointContact.safeParse(req.params);
  if (!identifiant.success) return repondreDonneesInvalides(res, identifiant.error);
  const options = schemaTelechargementQr.safeParse(req.query);
  if (!options.success) return repondreDonneesInvalides(res, options.error);

  try {
    const perimetre = await sitesAutorises(ctx.utilisateur);
    const point = await lirePointPourQr(ctx.organisationId, perimetre, identifiant.data.id);
    if (!point) return repondreNonTrouve(res, "Point de contact introuvable.");

    if (point.revoque_le !== null) {
      res.status(409).json({
        code: "QR_REVOQUE",
        message: "Ce QR code est revoque. Regenerez-le pour en obtenir un nouveau.",
        details: null,
      });
      return;
    }

    const adresse = adresseDuQr(point.code_public);
    const base = "qr-" + nomDeFichier(point.nom);
    const { format, taille, largeur } = options.data;

    if (format === "png") {
      const png = await genererQrPng(adresse, largeur);
      envoyerFichier(res, png, "image/png", base + ".png");
      return;
    }

    if (format === "svg") {
      const svg = await genererQrSvg(adresse);
      envoyerFichier(res, svg, "image/svg+xml; charset=utf-8", base + ".svg");
      return;
    }

    const organisation = await lireOrganisationPourChevalet(ctx.organisationId);
    const pdf = await genererChevaletPdf({ nom: point.nom, adresse }, taille, {
      nomOrganisation: organisation.nom,
      couleur: organisation.couleur,
    });
    envoyerFichier(res, pdf, "application/pdf", "chevalet-" + nomDeFichier(point.nom) + "-" + taille.toLowerCase() + ".pdf");
  } catch (erreur) {
    repondreErreurServeur(res, erreur);
  }
}

// GET /points-contact/planche?site_id=...
export async function telechargerLaPlanche(req: Request, res: Response): Promise<void> {
  const ctx = contexte(req);
  if (!ctx) return repondreNonConnecte(res);

  const filtre = schemaFiltrePointsContact.safeParse(req.query);
  if (!filtre.success) return repondreDonneesInvalides(res, filtre.error);

  try {
    const perimetre = await sitesAutorises(ctx.utilisateur);
    const points = await listerPointsPourPlanche(ctx.organisationId, perimetre, filtre.data.site_id);

    if (points.length === 0) {
      return repondreNonTrouve(res, "Aucun point de contact a imprimer.");
    }
    if (points.length > LIMITE_PLANCHE) {
      res.status(400).json({
        code: "TROP_DE_POINTS",
        message:
          "La planche est limitee a " +
          String(LIMITE_PLANCHE) +
          " chevalets. Filtrez par site pour imprimer en plusieurs fois.",
        details: null,
      });
      return;
    }

    const organisation = await lireOrganisationPourChevalet(ctx.organisationId);
    const pdf = await genererPlancheA4Pdf(
      points.map((point) => ({ nom: point.nom, adresse: adresseDuQr(point.code_public) })),
      { nomOrganisation: organisation.nom, couleur: organisation.couleur },
    );
    envoyerFichier(res, pdf, "application/pdf", "planche-qr.pdf");
  } catch (erreur) {
    repondreErreurServeur(res, erreur);
  }
}

// POST /points-contact/:id/revoquer   { "regenerer": true }  (corps facultatif)
export async function revoquerUnQr(req: Request, res: Response): Promise<void> {
  const ctx = contexte(req);
  if (!ctx) return repondreNonConnecte(res);

  const identifiant = schemaIdPointContact.safeParse(req.params);
  if (!identifiant.success) return repondreDonneesInvalides(res, identifiant.error);
  const lecture = schemaRevocationQr.safeParse(req.body ?? {});
  if (!lecture.success) return repondreDonneesInvalides(res, lecture.error);

  try {
    const point = await revoquerQr({
      organisationId: ctx.organisationId,
      pointContactId: identifiant.data.id,
      regenerer: lecture.data.regenerer,
      utilisateurId: ctx.utilisateur.id,
      ip: req.ip,
    });
    if (!point) return repondreNonTrouve(res, "Point de contact introuvable.");

    // Le code public n'est jamais renvoye : on telecharge le QR avec la route /qr.
    res.status(200).json({
      action: lecture.data.regenerer ? "regenere" : "revoque",
      point_contact: {
        id: point.id,
        nom: point.nom,
        site_id: point.site_id,
        actif: point.actif,
        revoque: point.revoque_le !== null,
        revoque_le: point.revoque_le,
      },
    });
  } catch (erreur) {
    repondreErreurServeur(res, erreur);
  }
}

// GET /points-contact/statistiques-qr?site_id=...
export async function lireLesStatistiquesQr(req: Request, res: Response): Promise<void> {
  const ctx = contexte(req);
  if (!ctx) return repondreNonConnecte(res);

  const filtre = schemaFiltrePointsContact.safeParse(req.query);
  if (!filtre.success) return repondreDonneesInvalides(res, filtre.error);

  try {
    const perimetre = await sitesAutorises(ctx.utilisateur);
    const statistiques = await statistiquesParQr(ctx.organisationId, perimetre, filtre.data.site_id);
    res.status(200).json({ statistiques });
  } catch (erreur) {
    repondreErreurServeur(res, erreur);
  }
}