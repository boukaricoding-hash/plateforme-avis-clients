import { Prisma } from "../../../../generated/prisma/client";
import { prisma } from "../../../configuration/base-de-donnees";
import type { PeriodeDashboard } from "../validations/dashboard";
import {
  arrondir,
  calculerTotaux,
  conditionSite,
  variation,
  versIndicateurs,
  type Indicateurs,
  type PorteeDashboard,
  type Variation,
} from "./indicateurs";

// ------------------------------------------------------------
// Chiffres cles du tableau de bord : GET /dashboard/kpis (jour 7, etape 4c)
// ------------------------------------------------------------
// Renvoie les indicateurs de la periode, leur evolution par rapport a la periode
// precedente (meme duree) et les alertes ouvertes.
// Une alerte est ouverte tant que son avis est "Nouveau" ou "En cours".
// Les alertes ouvertes ne dependent pas de la periode : une alerte non traitee
// reste a traiter. Elles respectent le perimetre et les filtres site, point, questionnaire.

const UNE_HEURE_EN_MS = 60 * 60 * 1000;
const UN_JOUR_EN_MS = 24 * 60 * 60 * 1000;
const NOMBRE_ALERTES_LISTEES = 5;
const STATUTS_OUVERTS: Array<"NOUVEAU" | "EN_COURS"> = ["NOUVEAU", "EN_COURS"];

export type AlerteOuverte = {
  avis_id: string;
  cree_le: string;
  anciennete_heures: number;
  motifs: string[];
};

export type AlertesOuvertes = {
  nombre: number;
  plus_ancienne_le: string | null;
  anciennete_max_heures: number | null;
  plus_anciennes: AlerteOuverte[];
};

export type ResultatKpis = {
  periode: {
    from: string;
    to: string;
    nombre_jours: number;
    precedente: { from: string; to: string };
  };
  indicateurs: Indicateurs;
  evolution: {
    nb_avis: Variation;
    note_moyenne: Variation;
    csat: Variation;
    nps: Variation;
    taux_reponse: Variation;
  };
  alertes_ouvertes: AlertesOuvertes;
};

// "AAAA-MM-JJ" du jour qui commence a cet instant (minuit UTC).
function jourTexte(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Filtre des alertes ouvertes. Renvoie null si le resultat est forcement vide.
function filtreAlertesOuvertes(portee: PorteeDashboard): Prisma.AlerteWhereInput | null {
  const site = conditionSite(portee.perimetre, portee.filtres.site);
  if (site === false) {
    return null;
  }

  const avis: Prisma.AvisWhereInput = {
    supprime_le: null,
    statut_traitement: { in: STATUTS_OUVERTS },
  };
  if (site !== undefined) {
    avis.site_id = site;
  }
  if (portee.filtres.point !== undefined) {
    avis.point_contact_id = portee.filtres.point;
  }
  if (portee.filtres.questionnaire !== undefined) {
    avis.version = { questionnaire_id: portee.filtres.questionnaire };
  }

  return { organisation_id: portee.organisationId, avis };
}

export async function lireAlertesOuvertes(
  portee: PorteeDashboard,
  maintenant: Date = new Date(),
): Promise<AlertesOuvertes> {
  const where = filtreAlertesOuvertes(portee);
  if (where === null) {
    return { nombre: 0, plus_ancienne_le: null, anciennete_max_heures: null, plus_anciennes: [] };
  }

  const nombre = await prisma.alerte.count({ where });
  const lignes = await prisma.alerte.findMany({
    where,
    orderBy: [{ cree_le: "asc" }, { id: "asc" }],
    take: NOMBRE_ALERTES_LISTEES,
    select: { avis_id: true, cree_le: true, motifs: true },
  });

  const plusAnciennes: AlerteOuverte[] = lignes.map((ligne) => ({
    avis_id: ligne.avis_id,
    cree_le: ligne.cree_le.toISOString(),
    anciennete_heures: arrondir((maintenant.getTime() - ligne.cree_le.getTime()) / UNE_HEURE_EN_MS, 1),
    motifs: ligne.motifs,
  }));

  const premiere = plusAnciennes[0];
  return {
    nombre,
    plus_ancienne_le: premiere ? premiere.cree_le : null,
    anciennete_max_heures: premiere ? premiere.anciennete_heures : null,
    plus_anciennes: plusAnciennes,
  };
}

export async function calculerKpis(
  portee: PorteeDashboard,
  periode: PeriodeDashboard,
  maintenant: Date = new Date(),
): Promise<ResultatKpis> {
  // Les requetes se font l'une apres l'autre : on ne prend qu'une connexion a la fois.
  const totauxActuels = await calculerTotaux(portee, periode.debut, periode.fin, maintenant);
  const totauxPrecedents = await calculerTotaux(
    portee,
    periode.debut_precedent,
    periode.debut,
    maintenant,
  );
  const alertes = await lireAlertesOuvertes(portee, maintenant);

  const actuel = versIndicateurs(totauxActuels);
  const precedent = versIndicateurs(totauxPrecedents);

  return {
    periode: {
      from: jourTexte(periode.debut),
      to: jourTexte(new Date(periode.fin.getTime() - UN_JOUR_EN_MS)),
      nombre_jours: periode.nombre_jours,
      precedente: {
        from: jourTexte(periode.debut_precedent),
        to: jourTexte(new Date(periode.debut.getTime() - UN_JOUR_EN_MS)),
      },
    },
    indicateurs: actuel,
    evolution: {
      nb_avis: variation(actuel.nb_avis, precedent.nb_avis),
      note_moyenne: variation(actuel.note_moyenne, precedent.note_moyenne),
      csat: variation(actuel.csat, precedent.csat),
      nps: variation(actuel.nps, precedent.nps),
      taux_reponse: variation(actuel.taux_reponse, precedent.taux_reponse),
    },
    alertes_ouvertes: alertes,
  };
}