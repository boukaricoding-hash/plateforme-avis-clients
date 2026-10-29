import { Prisma } from "../../../../generated/prisma/client";
import { prisma } from "../../../configuration/base-de-donnees";
import type { FiltresDashboard } from "../validations/dashboard";

// ------------------------------------------------------------
// Calcul commun des indicateurs du tableau de bord (jour 7)
// ------------------------------------------------------------
// Formules (cahier des charges, section 6.4 et annexe B) :
// - note moyenne : moyenne des notes globales (sur 5) ;
// - CSAT : avis notes 4 ou plus, divises par les avis notes, x 100 ;
// - NPS : % promoteurs (9-10) moins % detracteurs (0-6) ;
// - taux de reponse : avis divises par scans, x 100.
//
// Sans filtre "questionnaire", on additionne les lignes de agregat_quotidien (rapide).
// Avec ce filtre, on calcule depuis les avis : l'agregat n'a pas de colonne questionnaire.
// Les jours sont des jours UTC (Africa/Lome = UTC+0).

const UN_JOUR_EN_MS = 24 * 60 * 60 * 1000;
const NOTE_SATISFAIT_MIN = 4;
const NPS_PROMOTEUR_MIN = 9;
const NPS_DETRACTEUR_MAX = 6;

// Ce que la route demande : l'organisation et le perimetre viennent de la session,
// les filtres viennent de l'adresse.
export type PorteeDashboard = {
  organisationId: string;
  // null = toute l'organisation (Responsable), sinon les sites du Gestionnaire.
  perimetre: string[] | null;
  filtres: Pick<FiltresDashboard, "site" | "point" | "questionnaire">;
};

export type Totaux = {
  nb_avis: number;
  nb_avis_notes: number;
  somme_notes: number;
  nb_satisfaits: number;
  nb_nps: number;
  nb_promoteurs: number;
  nb_detracteurs: number;
  nb_scans: number;
  // Index 0 = avis notes 1, ..., index 4 = avis notes 5.
  repartition_notes: number[];
};

export function totauxVides(): Totaux {
  return {
    nb_avis: 0,
    nb_avis_notes: 0,
    somme_notes: 0,
    nb_satisfaits: 0,
    nb_nps: 0,
    nb_promoteurs: 0,
    nb_detracteurs: 0,
    nb_scans: 0,
    repartition_notes: [0, 0, 0, 0, 0],
  };
}

export function arrondir(valeur: number, decimales: number): number {
  const facteur = 10 ** decimales;
  return Math.round(valeur * facteur) / facteur;
}

// ------------------------------------------------------------
// Filtres (perimetre du gestionnaire + filtre "site" demande)
// ------------------------------------------------------------

// Croise le perimetre du gestionnaire (null = tout) avec le filtre "site".
// Renvoie false si le resultat est forcement vide (site hors perimetre).
export function conditionSite(
  perimetre: string[] | null,
  site: string | undefined,
): string | { in: string[] } | undefined | false {
  if (perimetre === null) {
    return site;
  }
  if (site !== undefined) {
    return perimetre.includes(site) ? site : false;
  }
  return { in: perimetre };
}

// Filtre des avis de la periode. Renvoie null si le resultat est forcement vide.
export function filtreAvis(
  portee: PorteeDashboard,
  debut: Date,
  fin: Date,
): Prisma.AvisWhereInput | null {
  const site = conditionSite(portee.perimetre, portee.filtres.site);
  if (site === false) {
    return null;
  }

  const where: Prisma.AvisWhereInput = {
    organisation_id: portee.organisationId,
    supprime_le: null,
    soumis_le: { gte: debut, lt: fin },
  };
  if (site !== undefined) {
    where.site_id = site;
  }
  if (portee.filtres.point !== undefined) {
    where.point_contact_id = portee.filtres.point;
  }
  if (portee.filtres.questionnaire !== undefined) {
    where.version = { questionnaire_id: portee.filtres.questionnaire };
  }
  return where;
}

// Filtre des agregats de la periode (le filtre "questionnaire" n'existe pas ici :
// l'appelant passe par les avis quand il est demande).
// Renvoie null si le resultat est forcement vide.
export function filtreAgregats(
  portee: PorteeDashboard,
  debut: Date,
  fin: Date,
): Prisma.AgregatQuotidienWhereInput | null {
  const site = conditionSite(portee.perimetre, portee.filtres.site);
  if (site === false) {
    return null;
  }

  const where: Prisma.AgregatQuotidienWhereInput = {
    organisation_id: portee.organisationId,
    date: { gte: debut, lt: fin },
  };
  if (site !== undefined) {
    where.site_id = site;
  }
  if (portee.filtres.point !== undefined) {
    where.point_contact_id = portee.filtres.point;
  }
  return where;
}

// ------------------------------------------------------------
// Lecture de l'histogramme enregistre en JSON ({ "1": n, ..., "5": n })
// ------------------------------------------------------------

export function lireRepartition(valeur: Prisma.JsonValue): number[] {
  const resultat = [0, 0, 0, 0, 0];
  if (valeur === null || typeof valeur !== "object" || Array.isArray(valeur)) {
    return resultat;
  }
  for (let note = 1; note <= 5; note++) {
    const nombre = valeur[String(note)];
    if (typeof nombre === "number") {
      resultat[note - 1] = nombre;
    }
  }
  return resultat;
}

// ------------------------------------------------------------
// Scans comptes directement dans la table scan
// ------------------------------------------------------------

async function compterScans(portee: PorteeDashboard, debut: Date, fin: Date): Promise<number> {
  if (fin.getTime() <= debut.getTime()) {
    return 0;
  }
  const site = conditionSite(portee.perimetre, portee.filtres.site);
  if (site === false) {
    return 0;
  }

  const where: Prisma.ScanWhereInput = {
    organisation_id: portee.organisationId,
    cree_le: { gte: debut, lt: fin },
  };
  if (portee.filtres.point !== undefined) {
    where.point_contact_id = portee.filtres.point;
  }

  // Un scan n'a pas de site : on passe par son point de contact.
  const relation: Prisma.PointContactWhereInput = {};
  if (site !== undefined) {
    relation.site_id = site;
  }
  if (portee.filtres.questionnaire !== undefined) {
    relation.questionnaire_id = portee.filtres.questionnaire;
  }
  if (Object.keys(relation).length > 0) {
    where.point_contact = relation;
  }

  return prisma.scan.count({ where });
}

// ------------------------------------------------------------
// Totaux depuis les avis (utilise quand le filtre "questionnaire" est demande)
// ------------------------------------------------------------

function ajouterNote(totaux: Totaux, note: number, nombre: number): void {
  totaux.nb_avis_notes += nombre;
  totaux.somme_notes += note * nombre;
  if (note >= NOTE_SATISFAIT_MIN) {
    totaux.nb_satisfaits += nombre;
  }
  const index = Math.min(5, Math.max(1, Math.round(note))) - 1;
  totaux.repartition_notes[index] = (totaux.repartition_notes[index] ?? 0) + nombre;
}

function ajouterNps(totaux: Totaux, valeur: number, nombre: number): void {
  totaux.nb_nps += nombre;
  if (valeur >= NPS_PROMOTEUR_MIN) {
    totaux.nb_promoteurs += nombre;
  } else if (valeur <= NPS_DETRACTEUR_MAX) {
    totaux.nb_detracteurs += nombre;
  }
}

async function totauxDepuisAvis(where: Prisma.AvisWhereInput): Promise<Totaux> {
  const totaux = totauxVides();

  totaux.nb_avis = await prisma.avis.count({ where });

  const parNote = await prisma.avis.groupBy({
    by: ["note_globale"],
    where: { ...where, note_globale: { not: null } },
    _count: { _all: true },
  });
  for (const groupe of parNote) {
    if (groupe.note_globale !== null) {
      ajouterNote(totaux, groupe.note_globale, groupe._count._all);
    }
  }

  const parNps = await prisma.avis.groupBy({
    by: ["nps"],
    where: { ...where, nps: { not: null } },
    _count: { _all: true },
  });
  for (const groupe of parNps) {
    if (groupe.nps !== null) {
      ajouterNps(totaux, groupe.nps, groupe._count._all);
    }
  }

  totaux.somme_notes = arrondir(totaux.somme_notes, 4);
  return totaux;
}

// ------------------------------------------------------------
// Totaux d'une periode
// ------------------------------------------------------------

// Les scans d'hier et d'aujourd'hui sont comptes directement dans la table scan :
// l'agregat ne les prend en compte qu'a la tache de nuit (02h00 UTC).
// Pour les jours plus anciens, on utilise nb_scans de l'agregat.
export async function calculerTotaux(
  portee: PorteeDashboard,
  debut: Date,
  fin: Date,
  maintenant: Date = new Date(),
): Promise<Totaux> {
  // Avec un filtre questionnaire : calcul direct depuis les avis.
  if (portee.filtres.questionnaire !== undefined) {
    const whereAvis = filtreAvis(portee, debut, fin);
    if (whereAvis === null) {
      return totauxVides();
    }
    const totaux = await totauxDepuisAvis(whereAvis);
    totaux.nb_scans = await compterScans(portee, debut, fin);
    return totaux;
  }

  const whereAgregats = filtreAgregats(portee, debut, fin);
  if (whereAgregats === null) {
    return totauxVides();
  }

  const lignes = await prisma.agregatQuotidien.findMany({
    where: whereAgregats,
    select: {
      date: true,
      nb_avis: true,
      nb_avis_notes: true,
      somme_notes: true,
      nb_satisfaits: true,
      nb_nps: true,
      nb_promoteurs: true,
      nb_detracteurs: true,
      nb_scans: true,
      repartition_notes: true,
    },
  });

  const aujourdhui = Date.UTC(
    maintenant.getUTCFullYear(),
    maintenant.getUTCMonth(),
    maintenant.getUTCDate(),
  );
  const seuilScansDirects = new Date(aujourdhui - UN_JOUR_EN_MS);

  const totaux = totauxVides();
  for (const ligne of lignes) {
    totaux.nb_avis += ligne.nb_avis;
    totaux.nb_avis_notes += ligne.nb_avis_notes;
    totaux.somme_notes += ligne.somme_notes;
    totaux.nb_satisfaits += ligne.nb_satisfaits;
    totaux.nb_nps += ligne.nb_nps;
    totaux.nb_promoteurs += ligne.nb_promoteurs;
    totaux.nb_detracteurs += ligne.nb_detracteurs;

    if (ligne.date.getTime() < seuilScansDirects.getTime()) {
      totaux.nb_scans += ligne.nb_scans;
    }

    const repartition = lireRepartition(ligne.repartition_notes);
    for (let index = 0; index < 5; index++) {
      totaux.repartition_notes[index] =
        (totaux.repartition_notes[index] ?? 0) + (repartition[index] ?? 0);
    }
  }
  totaux.somme_notes = arrondir(totaux.somme_notes, 4);

  const debutDirect = new Date(Math.max(debut.getTime(), seuilScansDirects.getTime()));
  totaux.nb_scans += await compterScans(portee, debutDirect, fin);

  return totaux;
}

// ------------------------------------------------------------
// Des totaux aux indicateurs affiches
// ------------------------------------------------------------

export type Indicateurs = {
  nb_avis: number;
  // Valeurs a null : aucune donnee (a ne pas afficher comme un 0).
  note_moyenne: number | null;
  csat: number | null;
  nps: number | null;
  nb_promoteurs: number;
  nb_passifs: number;
  nb_detracteurs: number;
  nb_reponses_nps: number;
  nb_scans: number;
  taux_reponse: number | null;
  repartition_notes: Array<{ note: number; nombre: number }>;
};

export function versIndicateurs(totaux: Totaux): Indicateurs {
  const noteMoyenne =
    totaux.nb_avis_notes > 0 ? arrondir(totaux.somme_notes / totaux.nb_avis_notes, 2) : null;
  const csat =
    totaux.nb_avis_notes > 0
      ? arrondir((totaux.nb_satisfaits / totaux.nb_avis_notes) * 100, 1)
      : null;
  const nps =
    totaux.nb_nps > 0
      ? arrondir(((totaux.nb_promoteurs - totaux.nb_detracteurs) / totaux.nb_nps) * 100, 1)
      : null;
  // Un avis arrive normalement apres un scan : on plafonne a 100 %.
  const tauxReponse =
    totaux.nb_scans > 0 ? arrondir(Math.min(100, (totaux.nb_avis / totaux.nb_scans) * 100), 1) : null;

  return {
    nb_avis: totaux.nb_avis,
    note_moyenne: noteMoyenne,
    csat,
    nps,
    nb_promoteurs: totaux.nb_promoteurs,
    nb_passifs: totaux.nb_nps - totaux.nb_promoteurs - totaux.nb_detracteurs,
    nb_detracteurs: totaux.nb_detracteurs,
    nb_reponses_nps: totaux.nb_nps,
    nb_scans: totaux.nb_scans,
    taux_reponse: tauxReponse,
    repartition_notes: totaux.repartition_notes.map((nombre, index) => ({
      note: index + 1,
      nombre,
    })),
  };
}

// ------------------------------------------------------------
// Evolution par rapport a la periode precedente
// ------------------------------------------------------------

export type Variation = {
  precedent: number | null;
  // Ecart en valeur (points de note, points de NPS, avis...).
  difference: number | null;
  // Ecart en pourcentage de la valeur precedente (null si elle vaut 0 ou manque).
  pourcentage: number | null;
};

export function variation(actuel: number | null, precedent: number | null): Variation {
  if (actuel === null || precedent === null) {
    return { precedent, difference: null, pourcentage: null };
  }
  return {
    precedent,
    difference: arrondir(actuel - precedent, 2),
    pourcentage:
      precedent === 0 ? null : arrondir(((actuel - precedent) / Math.abs(precedent)) * 100, 1),
  };
}