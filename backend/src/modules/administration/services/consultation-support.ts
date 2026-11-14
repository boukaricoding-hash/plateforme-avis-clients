import { lireAvis, listerAvis } from "../../avis/services/avis";
import type { FiltresAvis } from "../../avis/validations/avis";
import { listerPointsContact } from "../../points-de-contact/services/points-contact";
import { listerSites } from "../../sites/services/sites";
import { calculerKpis } from "../../tableaux-de-bord/services/kpis";
import { resoudrePeriode, type FiltresDashboard } from "../../tableaux-de-bord/validations/dashboard";
import { listerUtilisateurs } from "../../utilisateurs/services/utilisateurs";
import { lireOrganisation } from "./organisations";

// ------------------------------------------------------------
// Consultation de support en lecture seule (jour 24)
// ------------------------------------------------------------
// Ce que l'equipe DTS peut lire d'une organisation qui a donne son accord :
// la fiche, les indicateurs, les avis, les sites, les points de contact et les utilisateurs.
// Ce fichier n'importe QUE des fonctions de lecture : aucune ecriture n'est possible ici.
// L'accord est verifie avant, a chaque requete, par le middleware exiger-acces-support.
// Le perimetre est toujours "toute l'organisation" (null) : le support n'est pas un Gestionnaire.
//
// Coordonnees des clients (nom, telephone, e-mail laisses avec consentement) : MASQUEES.
// Le support voit les notes, les commentaires et l'historique, jamais les coordonnees.
// Les utilisateurs sont lus sans mot de passe (la lecture existante ne le charge jamais).

// Fiche de l'organisation. Renvoie null si elle n'existe pas ou a ete supprimee.
export async function lireFicheSupport(organisationId: string) {
  return lireOrganisation(organisationId);
}

// Memes chiffres que le tableau de bord du Responsable (filtres from, to, site, point, questionnaire).
export async function lireIndicateursSupport(organisationId: string, filtres: FiltresDashboard) {
  return calculerKpis({ organisationId, perimetre: null, filtres }, resoudrePeriode(filtres));
}

// Liste des avis : un extrait du commentaire, aucune coordonnee.
export async function listerAvisSupport(organisationId: string, filtres: FiltresAvis) {
  return listerAvis(organisationId, null, filtres);
}

// Detail d'un avis : renvoie null s'il n'existe pas dans CETTE organisation.
// Les coordonnees sont retirees meme si le client a donne son consentement.
export async function lireAvisSupport(organisationId: string, avisId: string) {
  const avis = await lireAvis(organisationId, null, avisId);
  if (avis === null) {
    return null;
  }
  return { ...avis, contact: null };
}

export async function listerSitesSupport(organisationId: string) {
  return listerSites(organisationId, null);
}

export async function listerPointsContactSupport(organisationId: string) {
  return listerPointsContact(organisationId, null, undefined);
}

export async function listerUtilisateursSupport(organisationId: string) {
  return listerUtilisateurs(organisationId);
}