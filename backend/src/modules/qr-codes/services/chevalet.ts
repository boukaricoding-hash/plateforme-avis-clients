import PDFDocument from "pdfkit";
import QRCode from "qrcode";

// ------------------------------------------------------------
// Chevalets et planches PDF (jour 8)
// ------------------------------------------------------------
// - Chevalet A6 ou A5 : logo (ou nom de l'organisation), "Votre avis compte,
//   scannez-moi", QR code, nom du point de contact.
// - Planche A4 : plusieurs chevalets (2 x 2 par page) avec traits de decoupe.
//
// Le QR code est dessine en vecteur (des carres noirs), pas en image :
// il reste net a n'importe quelle taille d'impression. Il est plus grand que
// le minimum de 3 x 3 cm sur tous les formats, en noir sur blanc, avec la
// marge blanche obligatoire de 4 modules.
//
// Ce fichier ne connait ni la base ni Express : on lui donne les textes,
// il renvoie le PDF. Aucune ecriture sur le disque.

export type FormatChevalet = "A6" | "A5";

export type PointPourChevalet = {
  nom: string;
  // Adresse complete contenue dans le QR code (voir adresseDuQr dans qr.ts).
  adresse: string;
};

export type OptionsChevalet = {
  nomOrganisation: string;
  // Couleur principale "#RRGGBB" ; bleu marine par defaut.
  couleur?: string | null;
  // Logo PNG ou JPEG. Sans logo (ou logo illisible), le nom de l'organisation le remplace.
  logo?: Buffer | null;
};

const COULEUR_PAR_DEFAUT = "#1F3A5F";
const NOIR = "#000000";
const BLANC = "#FFFFFF";
const GRIS_COUPE = "#888888";
const MARGE_QR_EN_MODULES = 4;
const MM_EN_POINTS = 72 / 25.4;
const MARGE_PLANCHE = 10 * MM_EN_POINTS;
const CHEVALETS_PAR_PAGE = 4;

function choisirCouleur(couleur: string | null | undefined): string {
  return couleur !== undefined && couleur !== null && /^#[0-9a-fA-F]{6}$/.test(couleur)
    ? couleur
    : COULEUR_PAR_DEFAUT;
}

// ------------------------------------------------------------
// Dessin du QR code (vecteur)
// ------------------------------------------------------------

// Dessine le QR code dans un carre de "taille" points, marge blanche comprise.
function dessinerQr(doc: PDFKit.PDFDocument, adresse: string, x: number, y: number, taille: number): void {
  const qr = QRCode.create(adresse, { errorCorrectionLevel: "M" });
  const nombreModules = qr.modules.size;
  const module = taille / (nombreModules + 2 * MARGE_QR_EN_MODULES);

  doc.save();
  doc.rect(x, y, taille, taille).fill(BLANC);
  doc.fillColor(NOIR);
  for (let ligne = 0; ligne < nombreModules; ligne++) {
    for (let colonne = 0; colonne < nombreModules; colonne++) {
      if (qr.modules.get(ligne, colonne)) {
        // Un tout petit recouvrement evite les fines lignes blanches entre carres.
        doc
          .rect(
            x + (colonne + MARGE_QR_EN_MODULES) * module,
            y + (ligne + MARGE_QR_EN_MODULES) * module,
            module + 0.15,
            module + 0.15,
          )
          .fill();
      }
    }
  }
  doc.restore();
}

// ------------------------------------------------------------
// Dessin d'un chevalet dans un rectangle
// ------------------------------------------------------------
// Toutes les tailles sont des fractions de la largeur et de la hauteur :
// le meme dessin sert pour l'A6, l'A5 et les cases de la planche A4.

function dessinerChevalet(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  largeur: number,
  hauteur: number,
  point: PointPourChevalet,
  options: OptionsChevalet,
): void {
  const couleur = choisirCouleur(options.couleur);
  const centre = x + largeur / 2;
  const largeurTexte = largeur * 0.84;
  const gauche = x + largeur * 0.08;

  // 1. En-tete : le logo, ou le nom de l'organisation.
  let logoDessine = false;
  if (options.logo !== undefined && options.logo !== null) {
    try {
      doc.image(options.logo, x + largeur * 0.2, y + hauteur * 0.05, {
        fit: [largeur * 0.6, hauteur * 0.11],
        align: "center",
        valign: "center",
      });
      logoDessine = true;
    } catch {
      // Logo illisible (format non pris en charge) : on affiche le nom a la place.
    }
  }
  if (!logoDessine) {
    doc
      .font("Helvetica-Bold")
      .fontSize(largeur * 0.07)
      .fillColor(couleur)
      .text(options.nomOrganisation, gauche, y + hauteur * 0.08, {
        width: largeurTexte,
        align: "center",
        height: hauteur * 0.08,
        ellipsis: true,
      });
  }

  // 2. Message d'invitation.
  doc
    .font("Helvetica-Bold")
    .fontSize(largeur * 0.092)
    .fillColor(NOIR)
    .text("Votre avis compte,", gauche, y + hauteur * 0.19, { width: largeurTexte, align: "center" })
    .text("scannez-moi", gauche, doc.y, { width: largeurTexte, align: "center" });

  // 3. QR code, centre.
  const tailleQr = Math.min(largeur * 0.64, hauteur * 0.4);
  dessinerQr(doc, point.adresse, centre - tailleQr / 2, y + hauteur * 0.37, tailleQr);

  // 4. Nom du point de contact (ex. "Table 12").
  doc
    .font("Helvetica-Bold")
    .fontSize(largeur * 0.12)
    .fillColor(couleur)
    .text(point.nom, gauche, y + hauteur * 0.83, {
      width: largeurTexte,
      align: "center",
      height: hauteur * 0.1,
      ellipsis: true,
    });

  // 5. Fin trait de couleur autour du chevalet.
  doc
    .lineWidth(largeur * 0.012)
    .strokeColor(couleur)
    .rect(x + largeur * 0.02, y + hauteur * 0.015, largeur * 0.96, hauteur * 0.97)
    .stroke();
}

// ------------------------------------------------------------
// Sortie en Buffer
// ------------------------------------------------------------

function terminer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const morceaux: Buffer[] = [];
    doc.on("data", (morceau: Buffer) => morceaux.push(morceau));
    doc.on("end", () => resolve(Buffer.concat(morceaux)));
    doc.on("error", reject);
    doc.end();
  });
}

// ------------------------------------------------------------
// Chevalet seul : A6 ou A5, une page
// ------------------------------------------------------------

export async function genererChevaletPdf(
  point: PointPourChevalet,
  format: FormatChevalet,
  options: OptionsChevalet,
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: format,
    margin: 0,
    info: { Title: "Chevalet " + point.nom, Author: options.nomOrganisation },
  });
  dessinerChevalet(doc, 0, 0, doc.page.width, doc.page.height, point, options);
  return terminer(doc);
}

// ------------------------------------------------------------
// Planche A4 : 4 chevalets par page (2 x 2), traits de decoupe en pointilles
// ------------------------------------------------------------

export async function genererPlancheA4Pdf(
  points: PointPourChevalet[],
  options: OptionsChevalet,
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4",
    margin: 0,
    autoFirstPage: false,
    info: { Title: "Planche de chevalets", Author: options.nomOrganisation },
  });

  doc.addPage();
  const largeurCase = (doc.page.width - 2 * MARGE_PLANCHE) / 2;
  const hauteurCase = (doc.page.height - 2 * MARGE_PLANCHE) / 2;

  points.forEach((point, index) => {
    const position = index % CHEVALETS_PAR_PAGE;
    if (index > 0 && position === 0) {
      doc.addPage();
    }
    const colonne = position % 2;
    const ligne = Math.floor(position / 2);
    const x = MARGE_PLANCHE + colonne * largeurCase;
    const y = MARGE_PLANCHE + ligne * hauteurCase;

    dessinerChevalet(doc, x, y, largeurCase, hauteurCase, point, options);

    // Trait de decoupe autour de la case.
    doc
      .save()
      .lineWidth(0.5)
      .strokeColor(GRIS_COUPE)
      .dash(4, { space: 3 })
      .rect(x, y, largeurCase, hauteurCase)
      .stroke()
      .undash()
      .restore();
  });

  return terminer(doc);
}