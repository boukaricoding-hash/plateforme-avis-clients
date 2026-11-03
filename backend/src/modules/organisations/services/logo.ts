import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "../../../configuration/base-de-donnees";
import { enregistrerAudit } from "../../journal-audit/services/journal";

// ------------------------------------------------------------
// Logo de l'organisation (jour 16)
// ------------------------------------------------------------
// Le fichier est range dans un dossier du serveur et servi a l'adresse
// /api/v1/logos/<fichier>. Le nom du fichier est toujours genere par le serveur
// (jamais celui envoye par l'utilisateur) et le format est verifie d'apres le
// contenu reel du fichier, pas d'apres son nom ni son type annonce.

// Taille maximale d'un logo : 1 Mo.
export const TAILLE_MAX_LOGO = 1024 * 1024;

// Debut de l'adresse d'un logo heberge par le serveur.
export const PREFIXE_URL_LOGO = "/api/v1/logos/";

type ExtensionLogo = "png" | "jpg" | "webp";

// Nom genere par le serveur : un identifiant aleatoire et une extension connue.
const NOM_FICHIER_LOGO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp)$/;

const SIGNATURE_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// Dossier des logos : LOGOS_DOSSIER s'il est renseigne, sinon televersements/logos
// a cote du serveur (dans Docker : /app/televersements/logos, sur un volume).
export function dossierLogos(): string {
  const configure = process.env["LOGOS_DOSSIER"];
  if (configure !== undefined && configure.trim() !== "") {
    return path.resolve(configure.trim());
  }
  return path.join(process.cwd(), "televersements", "logos");
}

// Reconnait le format d'apres les premiers octets. Renvoie null si ce n'est ni un PNG,
// ni un JPEG, ni un WebP (le SVG est refuse volontairement : il peut contenir du code).
export function detecterFormatLogo(contenu: Buffer): ExtensionLogo | null {
  if (contenu.length >= SIGNATURE_PNG.length && contenu.subarray(0, SIGNATURE_PNG.length).equals(SIGNATURE_PNG)) {
    return "png";
  }
  if (contenu.length >= 3 && contenu[0] === 0xff && contenu[1] === 0xd8 && contenu[2] === 0xff) {
    return "jpg";
  }
  if (contenu.length >= 12 && contenu.toString("ascii", 0, 4) === "RIFF" && contenu.toString("ascii", 8, 12) === "WEBP") {
    return "webp";
  }
  return null;
}

// Nom du fichier d'apres l'adresse enregistree. null si le logo n'est pas heberge par
// le serveur (adresse externe) ou si le nom n'a pas la forme attendue : on ne touche alors a aucun fichier.
function nomFichierDepuisAdresse(logoUrl: string | null): string | null {
  if (logoUrl === null || !logoUrl.startsWith(PREFIXE_URL_LOGO)) {
    return null;
  }
  const nom = logoUrl.slice(PREFIXE_URL_LOGO.length);
  return NOM_FICHIER_LOGO.test(nom) ? nom : null;
}

// Supprime un ancien fichier. Une erreur (fichier deja absent, par exemple) ne bloque jamais l'action.
async function supprimerFichierLogo(logoUrl: string | null): Promise<void> {
  const nom = nomFichierDepuisAdresse(logoUrl);
  if (nom === null) {
    return;
  }
  try {
    await fs.unlink(path.join(dossierLogos(), nom));
  } catch (erreur) {
    console.error("Logo : ancien fichier non supprime (" + nom + ") :", erreur);
  }
}

export type ResultatLogo =
  | { statut: "ok"; logo_url: string | null }
  | { statut: "format_invalide" }
  | { statut: "organisation_introuvable" };

// Enregistre un nouveau logo : ecrit le fichier, met a jour l'adresse, supprime l'ancien fichier.
// L'organisation vient toujours de la session, jamais de la requete.
export async function enregistrerLogo(params: {
  organisationId: string;
  utilisateurId: string;
  ip: string | undefined;
  contenu: Buffer;
}): Promise<ResultatLogo> {
  const format = detecterFormatLogo(params.contenu);
  if (format === null || params.contenu.length > TAILLE_MAX_LOGO) {
    return { statut: "format_invalide" };
  }

  const organisation = await prisma.organisation.findFirst({
    where: { id: params.organisationId, supprime_le: null },
    select: { logo_url: true },
  });
  if (!organisation) {
    return { statut: "organisation_introuvable" };
  }

  // 1. Ecriture du fichier sous un nom genere par le serveur ("wx" : jamais d'ecrasement).
  const dossier = dossierLogos();
  await fs.mkdir(dossier, { recursive: true });
  const nom = randomUUID() + "." + format;
  await fs.writeFile(path.join(dossier, nom), params.contenu, { flag: "wx" });

  // 2. Mise a jour de l'adresse. Si elle echoue, le nouveau fichier est retire : pas de fichier orphelin.
  const logoUrl = PREFIXE_URL_LOGO + nom;
  try {
    await prisma.organisation.update({
      where: { id: params.organisationId },
      data: { logo_url: logoUrl },
      select: { id: true },
    });
  } catch (erreur) {
    await fs.unlink(path.join(dossier, nom)).catch(() => undefined);
    throw erreur;
  }

  // 3. Ancien fichier supprime seulement apres la reussite de la mise a jour.
  await supprimerFichierLogo(organisation.logo_url);

  await enregistrerAudit({
    action: "LOGO_ORGANISATION_MODIFIE",
    utilisateurId: params.utilisateurId,
    organisationId: params.organisationId,
    ip: params.ip,
    details: { format, taille: params.contenu.length },
  });

  return { statut: "ok", logo_url: logoUrl };
}

// Retire le logo de l'organisation. Sans logo, l'appel reussit quand meme (rien a retirer).
export async function supprimerLogo(params: {
  organisationId: string;
  utilisateurId: string;
  ip: string | undefined;
}): Promise<ResultatLogo> {
  const organisation = await prisma.organisation.findFirst({
    where: { id: params.organisationId, supprime_le: null },
    select: { logo_url: true },
  });
  if (!organisation) {
    return { statut: "organisation_introuvable" };
  }
  if (organisation.logo_url === null) {
    return { statut: "ok", logo_url: null };
  }

  await prisma.organisation.update({
    where: { id: params.organisationId },
    data: { logo_url: null },
    select: { id: true },
  });
  await supprimerFichierLogo(organisation.logo_url);

  await enregistrerAudit({
    action: "LOGO_ORGANISATION_SUPPRIME",
    utilisateurId: params.utilisateurId,
    organisationId: params.organisationId,
    ip: params.ip,
  });

  return { statut: "ok", logo_url: null };
}

// Contenu du logo pour les chevalets PDF. Le PDF sait dessiner le PNG et le JPEG, pas le WebP :
// avec un WebP, un logo externe ou un fichier absent, on renvoie null et le chevalet affiche le nom.
export async function lireLogoPourChevalet(logoUrl: string | null): Promise<Buffer | null> {
  const nom = nomFichierDepuisAdresse(logoUrl);
  if (nom === null || nom.endsWith(".webp")) {
    return null;
  }
  try {
    return await fs.readFile(path.join(dossierLogos(), nom));
  } catch {
    return null;
  }
}