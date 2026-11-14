import { prisma } from "../../../configuration/base-de-donnees";
import type { FiltresJournal } from "../validations/journal";

const UN_JOUR_EN_MS = 24 * 60 * 60 * 1000;

// Le journal ne montre jamais un secret : on retire toute cle qui y ressemble, et on garde seulement
// les valeurs simples (texte, nombre, booleen, vide). Les textes trop longs sont coupes.
const CLES_INTERDITES = /mot_de_passe|motdepasse|password|jeton|token|secret|hash|cookie/i;
const LONGUEUR_MAX_TEXTE = 200;

type ValeurDetail = string | number | boolean | null;
export type DetailsJournal = Record<string, ValeurDetail>;

// Renvoie null s'il ne reste rien a montrer.
export function nettoyerDetails(details: unknown): DetailsJournal | null {
  if (details === null || typeof details !== "object" || Array.isArray(details)) {
    return null;
  }

  const propres: DetailsJournal = {};
  for (const [cle, valeur] of Object.entries(details as Record<string, unknown>)) {
    if (CLES_INTERDITES.test(cle)) {
      continue;
    }
    if (valeur === null || typeof valeur === "number" || typeof valeur === "boolean") {
      propres[cle] = valeur;
    } else if (typeof valeur === "string") {
      propres[cle] = valeur.length > LONGUEUR_MAX_TEXTE ? valeur.slice(0, LONGUEUR_MAX_TEXTE) + "..." : valeur;
    }
  }
  return Object.keys(propres).length > 0 ? propres : null;
}

// Les champs lus : jamais l'adresse IP (inutile a l'ecran), le mot de passe de l'auteur n'est pas lu du tout.
const CHAMPS_ENTREE = {
  id: true,
  action: true,
  entite: true,
  entite_id: true,
  details: true,
  cree_le: true,
  utilisateur: { select: { id: true, email: true, nom: true, role: true } },
  organisation: { select: { id: true, nom: true } },
} as const;

// Liste paginee de toutes les organisations, la plus recente d'abord. Les filtres sont tous facultatifs.
// Les jours du filtre sont lus en UTC (le fuseau Africa/Lome est a UTC+0, sans heure d'ete).
export async function consulterLeJournal(filtres: FiltresJournal) {
  const periode: { gte?: Date; lt?: Date } = {};
  if (filtres.du !== undefined) {
    periode.gte = new Date(`${filtres.du}T00:00:00.000Z`);
  }
  if (filtres.au !== undefined) {
    periode.lt = new Date(Date.parse(`${filtres.au}T00:00:00.000Z`) + UN_JOUR_EN_MS);
  }

  const where = {
    ...(filtres.action !== undefined ? { action: filtres.action } : {}),
    ...(filtres.organisation !== undefined ? { organisation_id: filtres.organisation } : {}),
    ...(filtres.utilisateur !== undefined
      ? { utilisateur: { email: { contains: filtres.utilisateur, mode: "insensitive" as const } } }
      : {}),
    ...(Object.keys(periode).length > 0 ? { cree_le: periode } : {}),
  };

  const [lignes, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      select: CHAMPS_ENTREE,
      orderBy: [{ cree_le: "desc" }, { id: "desc" }],
      skip: (filtres.page - 1) * filtres.limite,
      take: filtres.limite,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    entrees: lignes.map((ligne) => ({
      id: ligne.id,
      action: ligne.action,
      entite: ligne.entite,
      entite_id: ligne.entite_id,
      details: nettoyerDetails(ligne.details),
      cree_le: ligne.cree_le,
      utilisateur: ligne.utilisateur,
      organisation: ligne.organisation,
    })),
    pagination: {
      page: filtres.page,
      limite: filtres.limite,
      total,
      pages: Math.ceil(total / filtres.limite),
    },
  };
}