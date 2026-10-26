import { createHmac, randomUUID } from "node:crypto";
import { prisma } from "../../../configuration/base-de-donnees";

// ------------------------------------------------------------
// Anti-doublon (etape 4)
// ------------------------------------------------------------
// Un client ne peut donner qu'un avis par appareil et par point de contact
// pendant une periode (6 heures par defaut, reglable par organisation).
//
// - Regle dure : meme cookie d'appareil + meme point de contact => refus.
// - Regle douce : meme IP + meme navigateur + meme point de contact => refus
//   seulement a partir de N avis, pour ne pas bloquer plusieurs clients
//   qui partagent le meme Wi-Fi ou la meme connexion mobile.
//
// L'IP n'est jamais enregistree en clair : seulement un hachage sale.
// L'empreinte est rangee dans avis.empreinte sous la forme
// "<empreinte appareil>.<empreinte reseau>" et effacee apres 7 jours.

export const NOM_COOKIE_APPAREIL = "appareil_avis";

export const OPTIONS_COOKIE_APPAREIL = {
  httpOnly: true,
  secure: process.env["NODE_ENV"] === "production",
  sameSite: "lax" as const,
  maxAge: 180 * 24 * 60 * 60 * 1000,
  path: "/",
};

const PERIODE_PAR_DEFAUT_HEURES = 6;
const CONSERVATION_EMPREINTES_JOURS = 7;
const SEUIL_RESEAU_PAR_DEFAUT = 5;
const LONGUEUR_HACHAGE = 32;
const FORME_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ResultatAntiDoublon = {
  refuse: boolean;
  motif: "appareil" | "reseau" | null;
  // A enregistrer dans l'avis (creerAvis, 4e parametre).
  empreinte: string;
  // A poser dans le cookie de l'appareil (nouveau ou deja connu).
  appareil_id: string;
};

type ParametresAntiDoublon = {
  organisationId: string;
  pointContactId: string;
  ip: string | undefined;
  userAgent: string | undefined;
  appareilId: string | undefined;
};

function lireSel(): string {
  const sel = process.env["SEL_EMPREINTE"];
  if (sel === undefined || sel.length < 16) {
    throw new Error("SEL_EMPREINTE manquant ou trop court (16 caracteres minimum) : voir backend/.env");
  }
  return sel;
}

// Hachage sale. JSON.stringify evite toute ambiguite entre les morceaux.
function hacher(...morceaux: string[]): string {
  return createHmac("sha256", lireSel())
    .update(JSON.stringify(morceaux))
    .digest("hex")
    .slice(0, LONGUEUR_HACHAGE);
}

function seuilReseau(): number {
  const valeur = Number(process.env["ANTI_DOUBLON_SEUIL_RESEAU"]);
  return Number.isInteger(valeur) && valeur >= 1 ? valeur : SEUIL_RESEAU_PAR_DEFAUT;
}

function cookieValide(valeur: unknown): valeur is string {
  return typeof valeur === "string" && FORME_UUID.test(valeur);
}

async function lirePeriodeHeures(organisationId: string): Promise<number> {
  const organisation = await prisma.organisation.findUnique({
    where: { id: organisationId },
    select: { periode_anti_doublon_heures: true },
  });
  const heures = organisation?.periode_anti_doublon_heures;
  return heures !== undefined && heures > 0 ? heures : PERIODE_PAR_DEFAUT_HEURES;
}

// Calcule l'empreinte et dit si cet envoi doit etre refuse.
// Ne cree rien en base : c'est creerAvis qui enregistre l'empreinte.
export async function verifierAntiDoublon(
  parametres: ParametresAntiDoublon,
): Promise<ResultatAntiDoublon> {
  const appareilId = cookieValide(parametres.appareilId) ? parametres.appareilId : randomUUID();

  const empreinteAppareil = hacher("appareil", appareilId, parametres.pointContactId);
  const empreinteReseau = hacher(
    "reseau",
    parametres.ip ?? "ip-inconnue",
    parametres.userAgent ?? "navigateur-inconnu",
    parametres.pointContactId,
  );
  const empreinte = `${empreinteAppareil}.${empreinteReseau}`;

  const heures = await lirePeriodeHeures(parametres.organisationId);
  const depuis = new Date(Date.now() - heures * 60 * 60 * 1000);

  // Regle dure : meme appareil.
  const memeAppareil = await prisma.avis.count({
    where: {
      point_contact_id: parametres.pointContactId,
      soumis_le: { gte: depuis },
      empreinte: { startsWith: `${empreinteAppareil}.` },
    },
  });
  if (memeAppareil > 0) {
    return { refuse: true, motif: "appareil", empreinte, appareil_id: appareilId };
  }

  // Regle douce : meme reseau et meme navigateur, a partir du seuil.
  const memeReseau = await prisma.avis.count({
    where: {
      point_contact_id: parametres.pointContactId,
      soumis_le: { gte: depuis },
      empreinte: { endsWith: `.${empreinteReseau}` },
    },
  });
  if (memeReseau >= seuilReseau()) {
    return { refuse: true, motif: "reseau", empreinte, appareil_id: appareilId };
  }

  return { refuse: false, motif: null, empreinte, appareil_id: appareilId };
}

// Efface les empreintes de plus de 7 jours (avis et scans).
// A brancher sur la tache de nuit. Renvoie le nombre de lignes nettoyees.
export async function purgerEmpreintesAnciennes(): Promise<number> {
  const limite = new Date(Date.now() - CONSERVATION_EMPREINTES_JOURS * 24 * 60 * 60 * 1000);

  const avis = await prisma.avis.updateMany({
    where: { soumis_le: { lt: limite }, empreinte: { not: null } },
    data: { empreinte: null },
  });
  const scans = await prisma.scan.updateMany({
    where: { cree_le: { lt: limite }, empreinte: { not: null } },
    data: { empreinte: null },
  });

  return avis.count + scans.count;
}