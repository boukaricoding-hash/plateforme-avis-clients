import QRCode from "qrcode";

// ------------------------------------------------------------
// Fabrication des QR codes (jour 8)
// ------------------------------------------------------------
// Ce fichier ne connait ni la base de donnees ni Express : il transforme
// un code public en adresse, puis une adresse en image (PNG ou SVG).
//
// - L'adresse contenue dans le QR est PUBLIC_BASE_URL/q/{code}.
// - Correction d'erreur "M" (environ 15 % de l'image peut etre abimee) :
//   un bon compromis entre solidite et taille du QR code.
// - Noir sur blanc, avec la marge blanche obligatoire (4 modules) :
//   c'est ce qui assure le meilleur contraste a l'impression.

const MARGE_EN_MODULES = 4;
const LARGEUR_PNG_PAR_DEFAUT = 1024;
const LARGEUR_PNG_MIN = 256;
const LARGEUR_PNG_MAX = 2048;

// Lit PUBLIC_BASE_URL au moment de l'appel (pas au chargement du fichier),
// pour que les tests puissent la changer.
export function lireAdressePublique(): string {
  const brute = (process.env["PUBLIC_BASE_URL"] ?? "").trim();
  if (brute === "") {
    throw new Error("PUBLIC_BASE_URL est vide : ajoutez-la dans le fichier .env.");
  }

  let adresse: URL;
  try {
    adresse = new URL(brute);
  } catch {
    throw new Error("PUBLIC_BASE_URL n'est pas une adresse valide : " + brute);
  }
  if (adresse.protocol !== "http:" && adresse.protocol !== "https:") {
    throw new Error("PUBLIC_BASE_URL doit commencer par http:// ou https://.");
  }

  // Sans le "/" final, pour ne jamais fabriquer "//q/".
  return brute.replace(/\/+$/, "");
}

// Adresse contenue dans le QR code d'un point de contact : PUBLIC_BASE_URL/q/{code}.
export function adresseDuQr(codePublic: string): string {
  return lireAdressePublique() + "/q/" + encodeURIComponent(codePublic);
}

// Image PNG du QR code. "largeur" est en pixels (bornee entre 256 et 2048).
export async function genererQrPng(
  adresse: string,
  largeur: number = LARGEUR_PNG_PAR_DEFAUT,
): Promise<Buffer> {
  const largeurSure = Math.min(LARGEUR_PNG_MAX, Math.max(LARGEUR_PNG_MIN, Math.round(largeur)));
  return QRCode.toBuffer(adresse, {
    type: "png",
    errorCorrectionLevel: "M",
    margin: MARGE_EN_MODULES,
    width: largeurSure,
    color: { dark: "#000000", light: "#FFFFFF" },
  });
}

// Image SVG du QR code (texte). Se redimensionne sans perte : ideal pour l'impression.
export async function genererQrSvg(adresse: string): Promise<string> {
  return QRCode.toString(adresse, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: MARGE_EN_MODULES,
    color: { dark: "#000000", light: "#FFFFFF" },
  });
}