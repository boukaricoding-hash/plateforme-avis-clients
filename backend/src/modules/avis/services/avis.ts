import { Prisma } from "../../../../generated/prisma/client";
import { prisma } from "../../../configuration/base-de-donnees";
import type { FiltresAvis } from "../validations/avis";

const LONGUEUR_EXTRAIT = 200;
const UN_JOUR_EN_MS = 24 * 60 * 60 * 1000;

// Coupe un long commentaire pour la liste (le texte complet est dans le detail).
function extrait(texte: string | null): string | null {
  if (texte === null) {
    return null;
  }
  return texte.length > LONGUEUR_EXTRAIT ? `${texte.slice(0, LONGUEUR_EXTRAIT).trimEnd()}...` : texte;
}

// Periode en jours complets, bornes comprises (jours UTC, comme Africa/Lome).
function conditionPeriode(from: string | undefined, to: string | undefined): Prisma.DateTimeFilter | undefined {
  if (from === undefined && to === undefined) {
    return undefined;
  }
  const condition: Prisma.DateTimeFilter = {};
  if (from !== undefined) {
    condition.gte = new Date(`${from}T00:00:00.000Z`);
  }
  if (to !== undefined) {
    condition.lt = new Date(Date.parse(`${to}T00:00:00.000Z`) + UN_JOUR_EN_MS);
  }
  return condition;
}

// Croise le perimetre du gestionnaire (null = tout) avec le filtre "site" demande.
// Renvoie false si le resultat est forcement vide.
function conditionSite(perimetre: string[] | null, site: string | undefined): Prisma.UuidFilter | string | undefined | false {
  if (perimetre === null) {
    return site;
  }
  if (site !== undefined) {
    return perimetre.includes(site) ? site : false;
  }
  return { in: perimetre };
}

function construireFiltre(
  organisationId: string,
  perimetre: string[] | null,
  filtres: FiltresAvis,
): Prisma.AvisWhereInput | null {
  const site = conditionSite(perimetre, filtres.site);
  if (site === false) {
    return null;
  }

  const where: Prisma.AvisWhereInput = {
    organisation_id: organisationId,
    supprime_le: null,
  };

  if (site !== undefined) {
    where.site_id = site;
  }
  const periode = conditionPeriode(filtres.from, filtres.to);
  if (periode !== undefined) {
    where.soumis_le = periode;
  }
  if (filtres.point !== undefined) {
    where.point_contact_id = filtres.point;
  }
  if (filtres.questionnaire !== undefined) {
    where.version = { questionnaire_id: filtres.questionnaire };
  }
  if (filtres.statut !== undefined) {
    where.statut_traitement = filtres.statut;
  }
  if (filtres.negatifs !== undefined) {
    // Un avis negatif est un avis qui a declenche une alerte.
    where.alerte = filtres.negatifs ? { isNot: null } : { is: null };
  }
  if (filtres.note_min !== undefined || filtres.note_max !== undefined) {
    where.note_globale = {
      ...(filtres.note_min !== undefined ? { gte: filtres.note_min } : {}),
      ...(filtres.note_max !== undefined ? { lte: filtres.note_max } : {}),
    };
  }

  // Conditions sur le commentaire : toutes s'appliquent ensemble (ET).
  const conditionsCommentaire: Prisma.AvisWhereInput[] = [];
  if (filtres.q !== undefined) {
    conditionsCommentaire.push({ commentaire: { contains: filtres.q, mode: "insensitive" } });
  }
  if (filtres.avec_commentaire === true) {
    conditionsCommentaire.push({ commentaire: { not: null } });
  } else if (filtres.avec_commentaire === false) {
    conditionsCommentaire.push({ commentaire: null });
  }
  if (conditionsCommentaire.length > 0) {
    where.AND = conditionsCommentaire;
  }

  return where;
}

function construireTri(filtres: FiltresAvis): Prisma.AvisOrderByWithRelationInput[] {
  const principal: Prisma.AvisOrderByWithRelationInput =
    filtres.tri === "soumis_le"
      ? { soumis_le: filtres.ordre }
      : { [filtres.tri]: { sort: filtres.ordre, nulls: "last" } };
  // L'identifiant departage les egalites : la pagination reste stable.
  return [principal, { id: "asc" }];
}

// ------------------------------------------------------------
// Liste des avis
// ------------------------------------------------------------

export async function listerAvis(
  organisationId: string,
  perimetre: string[] | null,
  filtres: FiltresAvis,
) {
  const where = construireFiltre(organisationId, perimetre, filtres);
  const pagination = { page: filtres.page, limite: filtres.limite };

  if (where === null) {
    return { avis: [], pagination: { ...pagination, total: 0, pages: 0 } };
  }

  const [lignes, total] = await Promise.all([
    prisma.avis.findMany({
      where,
      orderBy: construireTri(filtres),
      skip: (filtres.page - 1) * filtres.limite,
      take: filtres.limite,
      select: {
        id: true,
        soumis_le: true,
        langue: true,
        appareil: true,
        note_globale: true,
        nps: true,
        commentaire: true,
        statut_traitement: true,
        site: { select: { id: true, nom: true } },
        point_contact: { select: { id: true, nom: true, type: true } },
        alerte: { select: { niveau: true } },
      },
    }),
    prisma.avis.count({ where }),
  ]);

  const avis = lignes.map(({ commentaire, alerte, ...reste }) => ({
    ...reste,
    commentaire_extrait: extrait(commentaire),
    en_alerte: alerte !== null,
    niveau_alerte: alerte ? alerte.niveau : null,
  }));

  return {
    avis,
    pagination: { ...pagination, total, pages: Math.ceil(total / filtres.limite) },
  };
}

// ------------------------------------------------------------
// Detail d'un avis
// ------------------------------------------------------------

// Renvoie null si l'avis n'existe pas, appartient a une autre organisation
// ou est hors du perimetre du gestionnaire : le controleur repond 404 dans les trois cas.
export async function lireAvis(organisationId: string, perimetre: string[] | null, id: string) {
  const avis = await prisma.avis.findFirst({
    where: {
      id,
      organisation_id: organisationId,
      supprime_le: null,
      ...(perimetre !== null ? { site_id: { in: perimetre } } : {}),
    },
    select: {
      id: true,
      soumis_le: true,
      langue: true,
      appareil: true,
      note_globale: true,
      nps: true,
      commentaire: true,
      statut_traitement: true,
      consentement: true,
      contact_nom: true,
      contact_tel: true,
      contact_email: true,
      site: { select: { id: true, nom: true } },
      point_contact: { select: { id: true, nom: true, type: true } },
      version: {
        select: {
          id: true,
          numero: true,
          questionnaire: { select: { id: true, titre: true } },
        },
      },
      reponses: {
        orderBy: { question: { ordre: "asc" } },
        select: {
          id: true,
          valeur_numerique: true,
          valeur_texte: true,
          valeur_choix: true,
          question: {
            select: {
              id: true,
              ordre: true,
              type: true,
              libelle: true,
              options: true,
              echelle_min: true,
              echelle_max: true,
              libelles_extremites: true,
            },
          },
        },
      },
      alerte: { select: { id: true, niveau: true, motifs: true, cree_le: true } },
      suivis: {
        orderBy: { cree_le: "desc" },
        select: {
          id: true,
          type: true,
          ancien_statut: true,
          nouveau_statut: true,
          commentaire: true,
          cree_le: true,
          utilisateur: { select: { id: true, nom: true } },
        },
      },
    },
  });

  if (avis === null) {
    return null;
  }

  const { contact_nom, contact_tel, contact_email, ...reste } = avis;

  return {
    ...reste,
    // Les coordonnees ne sortent que si le client a coche la case de consentement.
    contact: avis.consentement
      ? { nom: contact_nom, telephone: contact_tel, email: contact_email }
      : null,
  };
}