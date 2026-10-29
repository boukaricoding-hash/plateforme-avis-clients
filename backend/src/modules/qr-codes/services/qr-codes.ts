import { prisma } from "../../../configuration/base-de-donnees";
import { enregistrerAudit } from "../../journal-audit/services/journal";
import { genererCodePublic } from "../../points-de-contact/services/points-contact";

// ------------------------------------------------------------
// QR codes : lecture, revocation et statistiques (jour 8)
// ------------------------------------------------------------
// Un QR code n'est pas une table a part : c'est le code_public d'un point de contact.
// Revoquer ou regenerer un QR code ne supprime JAMAIS rien : les scans et les avis
// restent lies au point de contact, donc l'historique est conserve.
//
// - Revoquer : revoque_le est rempli. Le meme code, deja imprime, affiche
//   la page "QR code desactive" (le code reste reconnu).
// - Regenerer : un nouveau code remplace l'ancien et revoque_le est vide.
//   L'ancien code, deja imprime, n'est plus reconnu (page "QR inconnu").
//   C'est aussi le moyen de remettre en service un QR code revoque.
//
// perimetre : null = toute l'organisation (Responsable), sinon la liste des
// sites du Gestionnaire. L'organisation vient toujours de la session.

// Une planche A4 contient 4 chevalets : 200 chevalets = 50 pages, c'est le maximum.
export const LIMITE_PLANCHE = 200;

const CHAMPS_QR = {
  id: true,
  nom: true,
  code_public: true,
  actif: true,
  revoque_le: true,
  site_id: true,
} as const;

export type PointQr = {
  id: string;
  nom: string;
  code_public: string;
  actif: boolean;
  revoque_le: Date | null;
  site_id: string;
};

// Condition "site" : le perimetre du Gestionnaire croise avec le filtre site_id demande.
function filtreSite(
  perimetre: string[] | null,
  siteId: string | undefined,
): { site_id?: string | { in: string[] } } {
  if (perimetre !== null) {
    const ids = siteId !== undefined ? perimetre.filter((id) => id === siteId) : perimetre;
    return { site_id: { in: ids } };
  }
  return siteId !== undefined ? { site_id: siteId } : {};
}

// Ordre naturel : "Table 2" avant "Table 10".
function comparerNoms(a: string, b: string): number {
  return a.localeCompare(b, "fr", { numeric: true });
}

// ------------------------------------------------------------
// Lecture
// ------------------------------------------------------------

// Nom et couleur de l'organisation, pour les chevalets.
// Le logo viendra avec les parametres de l'organisation (jour 16).
export async function lireOrganisationPourChevalet(
  organisationId: string,
): Promise<{ nom: string; couleur: string | null }> {
  const organisation = await prisma.organisation.findUnique({
    where: { id: organisationId },
    select: { nom: true, couleur_principale: true },
  });
  if (!organisation) {
    throw new Error("Organisation introuvable : " + organisationId);
  }
  return { nom: organisation.nom, couleur: organisation.couleur_principale };
}

// Un point de contact de CETTE organisation (et du perimetre). null sinon.
export async function lirePointPourQr(
  organisationId: string,
  perimetre: string[] | null,
  pointContactId: string,
): Promise<PointQr | null> {
  return prisma.pointContact.findFirst({
    where: {
      id: pointContactId,
      organisation_id: organisationId,
      supprime_le: null,
      ...filtreSite(perimetre, undefined),
    },
    select: CHAMPS_QR,
  });
}

// Les points a imprimer sur une planche : actifs et non revoques, dans l'ordre naturel.
export async function listerPointsPourPlanche(
  organisationId: string,
  perimetre: string[] | null,
  siteId: string | undefined,
): Promise<PointQr[]> {
  const points = await prisma.pointContact.findMany({
    where: {
      organisation_id: organisationId,
      supprime_le: null,
      actif: true,
      revoque_le: null,
      ...filtreSite(perimetre, siteId),
    },
    select: CHAMPS_QR,
  });
  return points.sort((a, b) => comparerNoms(a.nom, b.nom));
}

// ------------------------------------------------------------
// Revoquer ou regenerer
// ------------------------------------------------------------

// Renvoie le point apres l'operation, ou null s'il n'existe pas dans CETTE organisation.
// Revoquer un QR deja revoque ne change rien (la date de la premiere revocation est gardee).
export async function revoquerQr(params: {
  organisationId: string;
  pointContactId: string;
  regenerer: boolean;
  utilisateurId: string;
  ip: string | undefined;
}): Promise<PointQr | null> {
  const existant = await prisma.pointContact.findFirst({
    where: {
      id: params.pointContactId,
      organisation_id: params.organisationId,
      supprime_le: null,
    },
    select: { id: true, nom: true, revoque_le: true },
  });
  if (!existant) {
    return null;
  }

  let modifie = false;
  if (params.regenerer) {
    const resultat = await prisma.pointContact.updateMany({
      where: { id: existant.id, organisation_id: params.organisationId, supprime_le: null },
      data: { code_public: genererCodePublic(), revoque_le: null },
    });
    modifie = resultat.count > 0;
  } else {
    // "revoque_le: null" dans la condition : deux demandes en meme temps ne revoquent qu'une fois.
    const resultat = await prisma.pointContact.updateMany({
      where: {
        id: existant.id,
        organisation_id: params.organisationId,
        supprime_le: null,
        revoque_le: null,
      },
      data: { revoque_le: new Date() },
    });
    modifie = resultat.count > 0;
  }

  if (modifie) {
    await enregistrerAudit({
      action: params.regenerer ? "QR_REGENERE" : "QR_REVOQUE",
      utilisateurId: params.utilisateurId,
      organisationId: params.organisationId,
      ip: params.ip,
      details: { point_contact_id: existant.id, nom: existant.nom },
    });
  }

  return prisma.pointContact.findFirst({
    where: { id: existant.id, organisation_id: params.organisationId },
    select: CHAMPS_QR,
  });
}

// ------------------------------------------------------------
// Statistiques par QR code
// ------------------------------------------------------------

export type StatistiquesQr = {
  point_contact_id: string;
  nom: string;
  site_id: string;
  actif: boolean;
  revoque: boolean;
  nb_scans: number;
  nb_avis: number;
  // Avis envoyes divises par scans, en pourcentage (plafonne a 100).
  // null : aucun scan (a ne pas afficher comme un 0).
  taux_conversion: number | null;
};

// Tous les scans et tous les avis (non supprimes) du point de contact depuis sa creation.
// Ils suivent le point de contact : les chiffres incluent les anciens codes regeneres.
export async function statistiquesParQr(
  organisationId: string,
  perimetre: string[] | null,
  siteId: string | undefined,
): Promise<StatistiquesQr[]> {
  const points = await prisma.pointContact.findMany({
    where: { organisation_id: organisationId, supprime_le: null, ...filtreSite(perimetre, siteId) },
    select: { id: true, nom: true, site_id: true, actif: true, revoque_le: true },
  });
  if (points.length === 0) {
    return [];
  }
  const identifiants = points.map((point) => point.id);

  // Les requetes se font l'une apres l'autre : on ne prend qu'une connexion a la fois.
  const scans = await prisma.scan.groupBy({
    by: ["point_contact_id"],
    where: { organisation_id: organisationId, point_contact_id: { in: identifiants } },
    _count: { _all: true },
  });
  const avis = await prisma.avis.groupBy({
    by: ["point_contact_id"],
    where: {
      organisation_id: organisationId,
      supprime_le: null,
      point_contact_id: { in: identifiants },
    },
    _count: { _all: true },
  });

  const scansParPoint = new Map(scans.map((ligne) => [ligne.point_contact_id, ligne._count._all]));
  const avisParPoint = new Map(avis.map((ligne) => [ligne.point_contact_id, ligne._count._all]));

  return points
    .map((point) => {
      const nbScans = scansParPoint.get(point.id) ?? 0;
      const nbAvis = avisParPoint.get(point.id) ?? 0;
      return {
        point_contact_id: point.id,
        nom: point.nom,
        site_id: point.site_id,
        actif: point.actif,
        revoque: point.revoque_le !== null,
        nb_scans: nbScans,
        nb_avis: nbAvis,
        taux_conversion:
          nbScans > 0 ? Math.round(Math.min(100, (nbAvis / nbScans) * 100) * 10) / 10 : null,
      };
    })
    .sort((a, b) => comparerNoms(a.nom, b.nom));
}