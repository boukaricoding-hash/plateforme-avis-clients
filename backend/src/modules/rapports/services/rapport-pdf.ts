import PDFDocument from "pdfkit";
import type { ScoreTheme } from "../../tableaux-de-bord/services/themes";
import type { PointSerie } from "../../tableaux-de-bord/services/serie-temporelle";
import type { PointAnalyse, ResultatAnalyse } from "./analyse";
import type { LangueExport } from "./collecte-avis";

// ------------------------------------------------------------
// Rapport PDF synthetique (jour 21)
// ------------------------------------------------------------
// Page 1 : logo, periode, resume, six indicateurs, trois graphiques dessines en vecteur
//          (repartition des notes, score par theme, avis par jour).
// Page 2 : trois points forts, trois points faibles, pistes d'action.
// Les chiffres et les textes viennent de analyse.ts (donc du tableau de bord) : ce fichier
// ne lit pas la base et ne connait pas Express. Il renvoie le PDF, rien n'est ecrit sur le disque.
// Polices standard du PDF (Helvetica) : elles suffisent pour le francais et l'anglais.

export type OptionsRapport = {
  nomOrganisation: string;
  // Couleur principale "#RRGGBB" ; bleu marine par defaut.
  couleur?: string | null;
  // Logo PNG ou JPEG. Sans logo (ou logo illisible), le nom de l'organisation le remplace.
  logo?: Buffer | null;
  // Date affichee en pied de page ; maintenant par defaut.
  genereLe?: Date;
};

const COULEUR_PAR_DEFAUT = "#1F3A5F";
const TEXTE = "#1B2430";
const GRIS = "#6B7685";
const TRAIT = "#D9DEE7";
const FOND = "#F4F6FA";
const BLANC = "#FFFFFF";
const VERT = "#2E9E5B";
const ORANGE = "#E39B1B";
const ROUGE = "#D64545";

const MARGE = 40;
const BAS_DE_PAGE = 56;
const NOTE_VERTE = 4.2;
const NOTE_ROUGE = 3.5;
const HEURES_ALERTE_QUI_TRAINE = 48;
const THEMES_AFFICHES = 6;

function choisirCouleur(couleur: string | null | undefined): string {
  return couleur !== undefined && couleur !== null && /^#[0-9a-fA-F]{6}$/.test(couleur)
    ? couleur
    : COULEUR_PAR_DEFAUT;
}

// ------------------------------------------------------------
// Petits outils de texte
// ------------------------------------------------------------

function nombre(valeur: number, decimales: number, langue: LangueExport): string {
  const texte = String(Number(valeur.toFixed(decimales)));
  return langue === "fr" ? texte.replace(".", ",") : texte;
}

function avecSigne(valeur: number, decimales: number, langue: LangueExport): string {
  const texte = nombre(Math.abs(valeur), decimales, langue);
  if (valeur > 0) {
    return `+${texte}`;
  }
  return valeur < 0 ? `-${texte}` : texte;
}

// "AAAA-MM-JJ" -> "JJ/MM/AAAA" en francais, inchange en anglais.
function dateEnTexte(jour: string, langue: LangueExport): string {
  if (langue === "en") {
    return jour;
  }
  const [annee, mois, jourDuMois] = jour.split("-");
  return `${jourDuMois}/${mois}/${annee}`;
}

// "AAAA-MM-JJ" -> "JJ/MM" en francais, "MM-JJ" en anglais (axe de la courbe).
function dateCourte(jour: string, langue: LangueExport): string {
  const [, mois, jourDuMois] = jour.split("-");
  return langue === "fr" ? `${jourDuMois}/${mois}` : `${mois}-${jourDuMois}`;
}

function couleurNote(note: number | null): string {
  if (note === null) {
    return GRIS;
  }
  if (note >= NOTE_VERTE) {
    return VERT;
  }
  return note >= NOTE_ROUGE ? ORANGE : ROUGE;
}

// Evolution par rapport a la periode precedente, en une courte phrase ("" si inconnue).
function texteEvolution(difference: number | null, unite: string, decimales: number, langue: LangueExport): string {
  if (difference === null) {
    return "";
  }
  const reference = langue === "fr" ? "vs période préc." : "vs previous period";
  if (difference === 0) {
    return `stable ${reference}`;
  }
  return `${avecSigne(difference, decimales, langue)} ${unite} ${reference}`;
}

function dureeEnTexte(heures: number, langue: LangueExport): string {
  if (heures >= 48) {
    const jours = Math.floor(heures / 24);
    return langue === "fr" ? `${jours} jours` : `${jours} days`;
  }
  return `${Math.max(1, Math.round(heures))} h`;
}

// ------------------------------------------------------------
// Briques de dessin
// ------------------------------------------------------------

// Titre de section avec un fin trait dessous. Renvoie le y ou commence le contenu.
function titreDeSection(doc: PDFKit.PDFDocument, texte: string, x: number, y: number, largeur: number, couleur: string): number {
  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor(couleur)
    .text(texte, x, y, { width: largeur, height: 14, ellipsis: true });
  doc
    .save()
    .lineWidth(0.6)
    .strokeColor(TRAIT)
    .moveTo(x, y + 17)
    .lineTo(x + largeur, y + 17)
    .stroke()
    .restore();
  return y + 26;
}

function aucuneDonnee(doc: PDFKit.PDFDocument, x: number, y: number, largeur: number, langue: LangueExport): void {
  doc
    .font("Helvetica-Oblique")
    .fontSize(9)
    .fillColor(GRIS)
    .text(langue === "fr" ? "Aucune donnée sur cette période." : "No data for this period.", x, y, {
      width: largeur,
      align: "center",
    });
}

function dessinerCarte(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  largeur: number,
  hauteur: number,
  carte: { libelle: string; valeur: string; couleur: string; ligne1: string; ligne2: string },
): void {
  doc.save().roundedRect(x, y, largeur, hauteur, 6).fill(FOND).restore();
  doc.save().rect(x, y + 6, 3, hauteur - 12).fill(carte.couleur).restore();

  const gauche = x + 12;
  const largeurTexte = largeur - 20;
  doc.font("Helvetica").fontSize(8.5).fillColor(GRIS).text(carte.libelle, gauche, y + 8, { width: largeurTexte, height: 11, ellipsis: true });
  doc.font("Helvetica-Bold").fontSize(20).fillColor(carte.couleur).text(carte.valeur, gauche, y + 20, { width: largeurTexte, height: 26, ellipsis: true });
  doc.font("Helvetica").fontSize(8).fillColor(TEXTE).text(carte.ligne1, gauche, y + 45, { width: largeurTexte, height: 10, ellipsis: true });
  doc.font("Helvetica").fontSize(8).fillColor(GRIS).text(carte.ligne2, gauche, y + 56, { width: largeurTexte, height: 10, ellipsis: true });
}

// ------------------------------------------------------------
// En-tete et resume
// ------------------------------------------------------------

function dessinerEntete(doc: PDFKit.PDFDocument, analyse: ResultatAnalyse, options: OptionsRapport, couleur: string): number {
  const langue = analyse.langue;
  const largeurPage = doc.page.width - 2 * MARGE;

  let logoDessine = false;
  if (options.logo !== undefined && options.logo !== null) {
    try {
      doc.image(options.logo, MARGE, MARGE, { fit: [140, 46], valign: "center" });
      logoDessine = true;
    } catch {
      // Logo illisible (format non pris en charge) : on affiche le nom a la place.
    }
  }
  if (!logoDessine) {
    doc
      .font("Helvetica-Bold")
      .fontSize(16)
      .fillColor(couleur)
      .text(options.nomOrganisation, MARGE, MARGE + 12, { width: 260, height: 22, ellipsis: true });
  }

  const titre = langue === "fr" ? "Rapport d’avis clients" : "Customer review report";
  const periode =
    langue === "fr"
      ? `Du ${dateEnTexte(analyse.periode.from, langue)} au ${dateEnTexte(analyse.periode.to, langue)} · ${analyse.periode.nombre_jours} jours`
      : `From ${dateEnTexte(analyse.periode.from, langue)} to ${dateEnTexte(analyse.periode.to, langue)} · ${analyse.periode.nombre_jours} days`;
  doc
    .font("Helvetica-Bold")
    .fontSize(15)
    .fillColor(TEXTE)
    .text(titre, MARGE + 270, MARGE + 4, { width: largeurPage - 270, height: 20, align: "right", ellipsis: true });
  doc
    .font("Helvetica")
    .fontSize(9.5)
    .fillColor(GRIS)
    .text(periode, MARGE + 270, MARGE + 28, { width: largeurPage - 270, height: 13, align: "right", ellipsis: true });

  doc.save().rect(MARGE, MARGE + 54, largeurPage, 3).fill(couleur).restore();
  return MARGE + 70;
}

function dessinerResume(doc: PDFKit.PDFDocument, analyse: ResultatAnalyse, y: number): number {
  const largeur = doc.page.width - 2 * MARGE;
  doc.font("Helvetica").fontSize(10).fillColor(TEXTE);
  const hauteur = doc.heightOfString(analyse.resume, { width: largeur });
  doc.text(analyse.resume, MARGE, y, { width: largeur });
  return y + hauteur + 12;
}

// ------------------------------------------------------------
// Les six indicateurs
// ------------------------------------------------------------

function dessinerIndicateurs(doc: PDFKit.PDFDocument, analyse: ResultatAnalyse, y: number): number {
  const langue = analyse.langue;
  const { kpis } = analyse.donnees;
  const ind = kpis.indicateurs;
  const evo = kpis.evolution;
  const alertes = kpis.alertes_ouvertes;
  const tiret = "–";

  const heuresAlerte = alertes.anciennete_max_heures;
  let couleurAlertes = VERT;
  if (alertes.nombre > 0) {
    couleurAlertes = heuresAlerte !== null && heuresAlerte >= HEURES_ALERTE_QUI_TRAINE ? ROUGE : ORANGE;
  }

  const cartes = [
    {
      libelle: langue === "fr" ? "Note moyenne" : "Average rating",
      valeur: ind.note_moyenne === null ? tiret : `${nombre(ind.note_moyenne, 2, langue)} / 5`,
      couleur: couleurNote(ind.note_moyenne),
      ligne1: langue === "fr" ? "sur toutes les notes" : "over all ratings",
      ligne2: texteEvolution(evo.note_moyenne.difference, "pt", 2, langue),
    },
    {
      libelle: "CSAT",
      valeur: ind.csat === null ? tiret : `${nombre(ind.csat, 1, langue)} %`,
      couleur: ind.csat === null ? GRIS : ind.csat >= 80 ? VERT : ind.csat >= 60 ? ORANGE : ROUGE,
      ligne1: langue === "fr" ? "avis notés 4 ou 5" : "reviews rated 4 or 5",
      ligne2: texteEvolution(evo.csat.difference, "pts", 1, langue),
    },
    {
      libelle: "NPS",
      valeur: ind.nps === null ? tiret : nombre(ind.nps, 1, langue),
      couleur: ind.nps === null ? GRIS : ind.nps >= 30 ? VERT : ind.nps >= 0 ? ORANGE : ROUGE,
      ligne1:
        langue === "fr"
          ? `${ind.nb_promoteurs} promoteurs · ${ind.nb_detracteurs} détracteurs`
          : `${ind.nb_promoteurs} promoters · ${ind.nb_detracteurs} detractors`,
      ligne2: texteEvolution(evo.nps.difference, "pts", 1, langue),
    },
    {
      libelle: langue === "fr" ? "Nombre d’avis" : "Number of reviews",
      valeur: String(ind.nb_avis),
      couleur: TEXTE,
      ligne1: langue === "fr" ? `${ind.nb_scans} scans du QR code` : `${ind.nb_scans} QR code scans`,
      ligne2: texteEvolution(evo.nb_avis.difference, langue === "fr" ? "avis" : "reviews", 0, langue),
    },
    {
      libelle: langue === "fr" ? "Taux de réponse" : "Response rate",
      valeur: ind.taux_reponse === null ? tiret : `${nombre(ind.taux_reponse, 1, langue)} %`,
      couleur: ind.taux_reponse === null ? GRIS : TEXTE,
      ligne1: langue === "fr" ? "avis divisés par scans" : "reviews divided by scans",
      ligne2: texteEvolution(evo.taux_reponse.difference, "pts", 1, langue),
    },
    {
      libelle: langue === "fr" ? "Alertes ouvertes" : "Open alerts",
      valeur: String(alertes.nombre),
      couleur: couleurAlertes,
      ligne1:
        heuresAlerte !== null
          ? langue === "fr"
            ? `la plus ancienne : ${dureeEnTexte(heuresAlerte, langue)}`
            : `oldest: ${dureeEnTexte(heuresAlerte, langue)}`
          : langue === "fr"
            ? "aucune en attente"
            : "none pending",
      ligne2: langue === "fr" ? "avis Nouveau ou En cours" : "reviews New or In progress",
    },
  ];

  const ecart = 10;
  const largeurCarte = (doc.page.width - 2 * MARGE - 2 * ecart) / 3;
  const hauteurCarte = 72;
  cartes.forEach((carte, index) => {
    const colonne = index % 3;
    const ligne = Math.floor(index / 3);
    dessinerCarte(doc, MARGE + colonne * (largeurCarte + ecart), y + ligne * (hauteurCarte + ecart), largeurCarte, hauteurCarte, carte);
  });
  return y + 2 * hauteurCarte + ecart + 16;
}

// ------------------------------------------------------------
// Graphiques
// ------------------------------------------------------------

function dessinerRepartition(
  doc: PDFKit.PDFDocument,
  repartition: Array<{ note: number; nombre: number }>,
  x: number,
  y: number,
  largeur: number,
  hauteur: number,
  couleur: string,
  langue: LangueExport,
): void {
  const debutContenu = titreDeSection(doc, langue === "fr" ? "Répartition des notes" : "Rating distribution", x, y, largeur, couleur);
  const total = repartition.reduce((somme, ligne) => somme + ligne.nombre, 0);
  if (total === 0) {
    aucuneDonnee(doc, x, debutContenu + 40, largeur, langue);
    return;
  }

  const haut = debutContenu + 14;
  const bas = y + hauteur - 16;
  const maximum = Math.max(1, ...repartition.map((ligne) => ligne.nombre));
  const espace = 12;
  const largeurBarre = (largeur - espace * (repartition.length - 1)) / repartition.length;

  repartition.forEach((ligne, index) => {
    const bx = x + index * (largeurBarre + espace);
    const hauteurBarre = (ligne.nombre / maximum) * (bas - haut);
    const by = bas - hauteurBarre;
    const couleurBarre = ligne.note <= 2 ? ROUGE : ligne.note === 3 ? ORANGE : VERT;

    doc.save().rect(bx, by, largeurBarre, Math.max(hauteurBarre, 0.5)).fill(couleurBarre).restore();
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(TEXTE).text(String(ligne.nombre), bx, by - 11, { width: largeurBarre, height: 10, align: "center", lineBreak: false });
    doc.font("Helvetica").fontSize(8.5).fillColor(GRIS).text(String(ligne.note), bx, bas + 4, { width: largeurBarre, height: 10, align: "center", lineBreak: false });
  });
  doc.save().lineWidth(0.6).strokeColor(TRAIT).moveTo(x, bas).lineTo(x + largeur, bas).stroke().restore();
}

function dessinerThemes(
  doc: PDFKit.PDFDocument,
  themes: ScoreTheme[],
  x: number,
  y: number,
  largeur: number,
  couleur: string,
  langue: LangueExport,
): void {
  const debutContenu = titreDeSection(doc, langue === "fr" ? "Score par thème (le plus faible d’abord)" : "Score by theme (lowest first)", x, y, largeur, couleur);
  if (themes.length === 0) {
    aucuneDonnee(doc, x, debutContenu + 40, largeur, langue);
    return;
  }

  const largeurLibelle = 104;
  const largeurValeur = 26;
  const largeurPiste = largeur - largeurLibelle - largeurValeur - 8;
  const hauteurLigne = 20;

  themes.slice(0, THEMES_AFFICHES).forEach((theme, index) => {
    const ly = debutContenu + 4 + index * hauteurLigne;
    const libelle = langue === "en" && theme.libelle_en.trim() !== "" ? theme.libelle_en : theme.libelle_fr;
    doc.font("Helvetica").fontSize(8.5).fillColor(TEXTE).text(libelle, x, ly + 2, { width: largeurLibelle - 6, height: 11, ellipsis: true });
    doc.save().roundedRect(x + largeurLibelle, ly + 1, largeurPiste, 10, 3).fill(FOND).restore();
    const remplissage = Math.max(0, Math.min(5, theme.score)) / 5;
    doc.save().roundedRect(x + largeurLibelle, ly + 1, Math.max(largeurPiste * remplissage, 3), 10, 3).fill(couleurNote(theme.score)).restore();
    doc
      .font("Helvetica-Bold")
      .fontSize(8.5)
      .fillColor(TEXTE)
      .text(nombre(theme.score, 1, langue), x + largeurLibelle + largeurPiste + 6, ly + 2, { width: largeurValeur, height: 11, align: "right", lineBreak: false });
  });
}

function dessinerCourbe(
  doc: PDFKit.PDFDocument,
  serie: PointSerie[],
  x: number,
  y: number,
  largeur: number,
  hauteur: number,
  couleur: string,
  langue: LangueExport,
): void {
  const debutContenu = titreDeSection(doc, langue === "fr" ? "Avis par jour" : "Reviews per day", x, y, largeur, couleur);
  const total = serie.reduce((somme, point) => somme + point.nb_avis, 0);
  if (serie.length === 0 || total === 0) {
    aucuneDonnee(doc, x, debutContenu + 30, largeur, langue);
    return;
  }

  const gauche = x + 24;
  const droite = x + largeur - 6;
  const haut = debutContenu + 6;
  const bas = y + hauteur - 18;
  const maximum = Math.max(1, ...serie.map((point) => point.nb_avis));
  const pas = serie.length > 1 ? (droite - gauche) / (serie.length - 1) : 0;
  const positionX = (index: number): number => (serie.length > 1 ? gauche + index * pas : (gauche + droite) / 2);
  const positionY = (valeur: number): number => bas - (valeur / maximum) * (bas - haut);

  // Lignes de repere : 0, milieu, maximum.
  doc.save().lineWidth(0.5).strokeColor(TRAIT);
  for (const repere of [0, maximum / 2, maximum]) {
    doc.moveTo(gauche, positionY(repere)).lineTo(droite, positionY(repere)).stroke();
  }
  doc.restore();
  doc.font("Helvetica").fontSize(8).fillColor(GRIS);
  doc.text("0", x, bas - 4, { width: 18, align: "right", lineBreak: false });
  doc.text(nombre(maximum, 0, langue), x, haut - 4, { width: 18, align: "right", lineBreak: false });

  // Surface legere sous la courbe, puis la courbe.
  if (serie.length > 1) {
    doc.save().fillColor(couleur).fillOpacity(0.12).moveTo(positionX(0), bas);
    serie.forEach((point, index) => doc.lineTo(positionX(index), positionY(point.nb_avis)));
    doc.lineTo(positionX(serie.length - 1), bas).closePath().fill().restore();

    doc.save().lineWidth(1.6).lineJoin("round").strokeColor(couleur).moveTo(positionX(0), positionY(serie[0]?.nb_avis ?? 0));
    serie.forEach((point, index) => doc.lineTo(positionX(index), positionY(point.nb_avis)));
    doc.stroke().restore();
  } else {
    doc.save().circle(positionX(0), positionY(serie[0]?.nb_avis ?? 0), 3).fill(couleur).restore();
  }

  // Dates : premiere, milieu, derniere.
  const reperes = serie.length > 2 ? [0, Math.floor((serie.length - 1) / 2), serie.length - 1] : serie.map((_, index) => index);
  reperes.forEach((index, rang) => {
    const point = serie[index];
    if (point === undefined) {
      return;
    }
    const alignement = rang === 0 ? "left" : rang === reperes.length - 1 ? "right" : "center";
    const debut = rang === 0 ? positionX(index) : rang === reperes.length - 1 ? positionX(index) - 60 : positionX(index) - 30;
    doc.font("Helvetica").fontSize(8).fillColor(GRIS).text(dateCourte(point.date, langue), debut, bas + 5, { width: 60, align: alignement, lineBreak: false });
  });
}

// ------------------------------------------------------------
// Points forts, points faibles, pistes
// ------------------------------------------------------------

// Dessine une colonne de points (une carte par point). Renvoie le y sous la derniere carte.
function dessinerColonnePoints(
  doc: PDFKit.PDFDocument,
  titre: string,
  points: PointAnalyse[],
  vide: string,
  x: number,
  y: number,
  largeur: number,
  couleurBande: string,
): number {
  let courant = titreDeSection(doc, titre, x, y, largeur, couleurBande);
  if (points.length === 0) {
    doc.font("Helvetica-Oblique").fontSize(9).fillColor(GRIS).text(vide, x, courant, { width: largeur });
    return courant + 30;
  }

  const rembourrage = 9;
  const largeurTexte = largeur - 2 * rembourrage - 4;
  for (const point of points) {
    doc.font("Helvetica-Bold").fontSize(10);
    const hauteurTitre = doc.heightOfString(point.titre, { width: largeurTexte });
    doc.font("Helvetica").fontSize(9);
    const hauteurDetail = doc.heightOfString(point.detail, { width: largeurTexte });
    const hauteurCarte = hauteurTitre + hauteurDetail + 2 * rembourrage + 4;

    doc.save().roundedRect(x, courant, largeur, hauteurCarte, 6).fill(FOND).restore();
    doc.save().rect(x, courant + 6, 3, hauteurCarte - 12).fill(couleurBande).restore();
    doc.font("Helvetica-Bold").fontSize(10).fillColor(TEXTE).text(point.titre, x + rembourrage + 4, courant + rembourrage, { width: largeurTexte });
    doc.font("Helvetica").fontSize(9).fillColor(GRIS).text(point.detail, x + rembourrage + 4, courant + rembourrage + hauteurTitre + 4, { width: largeurTexte });
    courant += hauteurCarte + 8;
  }
  return courant;
}

function dessinerPistes(doc: PDFKit.PDFDocument, pistes: PointAnalyse[], y: number, couleur: string, langue: LangueExport): number {
  const largeur = doc.page.width - 2 * MARGE;
  let courant = titreDeSection(doc, langue === "fr" ? "Pistes d’action" : "Suggested actions", MARGE, y, largeur, couleur);

  pistes.forEach((piste, index) => {
    doc.font("Helvetica-Bold").fontSize(10);
    const hauteurTitre = doc.heightOfString(piste.titre, { width: largeur - 30 });
    doc.font("Helvetica").fontSize(9);
    const hauteurDetail = doc.heightOfString(piste.detail, { width: largeur - 30 });
    const hauteurBloc = hauteurTitre + hauteurDetail + 12;

    if (courant + hauteurBloc > doc.page.height - BAS_DE_PAGE) {
      doc.addPage();
      courant = MARGE;
    }
    doc.save().circle(MARGE + 9, courant + 8, 8).fill(couleur).restore();
    doc.font("Helvetica-Bold").fontSize(9).fillColor(BLANC).text(String(index + 1), MARGE + 1, courant + 4.5, { width: 16, align: "center", lineBreak: false });
    doc.font("Helvetica-Bold").fontSize(10).fillColor(TEXTE).text(piste.titre, MARGE + 28, courant, { width: largeur - 30 });
    doc.font("Helvetica").fontSize(9).fillColor(GRIS).text(piste.detail, MARGE + 28, courant + hauteurTitre + 3, { width: largeur - 30 });
    courant += hauteurBloc + 6;
  });
  return courant;
}

function dessinerASavoir(doc: PDFKit.PDFDocument, y: number, langue: LangueExport): void {
  const largeur = doc.page.width - 2 * MARGE;
  const texte =
    langue === "fr"
      ? "Cette analyse est calculée par des règles sur vos données (comparaisons, seuils, classements). Ce n’est pas un modèle d’IA externe : rien ne quitte le serveur. Elle porte sur la période, le site, le point de contact et le questionnaire choisis."
      : "This analysis is computed by rules applied to your data (comparisons, thresholds, rankings). It is not an external AI model: nothing leaves the server. It covers the chosen period, site, contact point and questionnaire.";
  doc.font("Helvetica-Oblique").fontSize(8.5);
  const hauteur = doc.heightOfString(texte, { width: largeur - 20 });
  const position = Math.min(y, doc.page.height - BAS_DE_PAGE - hauteur - 16);
  doc.save().roundedRect(MARGE, position, largeur, hauteur + 16, 6).fill(FOND).restore();
  doc.font("Helvetica-Oblique").fontSize(8.5).fillColor(GRIS).text(texte, MARGE + 10, position + 8, { width: largeur - 20 });
}

// ------------------------------------------------------------
// Pied de page et sortie en Buffer
// ------------------------------------------------------------

function ajouterPiedsDePage(doc: PDFKit.PDFDocument, options: OptionsRapport, langue: LangueExport, couleur: string): void {
  const genereLe = (options.genereLe ?? new Date()).toISOString().slice(0, 10);
  const gauche =
    langue === "fr"
      ? `${options.nomOrganisation} · Rapport d’avis clients · généré le ${dateEnTexte(genereLe, langue)}`
      : `${options.nomOrganisation} · Customer review report · generated on ${genereLe}`;
  const largeur = doc.page.width - 2 * MARGE;

  const pages = doc.bufferedPageRange();
  for (let index = 0; index < pages.count; index += 1) {
    doc.switchToPage(pages.start + index);
    // Le pied de page est dans la marge du bas : sans cette remise a zero, PDFKit ajouterait une page.
    doc.page.margins.bottom = 0;
    const y = doc.page.height - 34;
    doc.save().lineWidth(0.6).strokeColor(couleur).moveTo(MARGE, y - 8).lineTo(MARGE + largeur, y - 8).stroke().restore();
    doc.font("Helvetica").fontSize(8).fillColor(GRIS).text(gauche, MARGE, y, { width: largeur - 80, height: 11, ellipsis: true, lineBreak: false });
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(GRIS)
      .text(langue === "fr" ? `Page ${index + 1} sur ${pages.count}` : `Page ${index + 1} of ${pages.count}`, MARGE + largeur - 80, y, {
        width: 80,
        height: 11,
        align: "right",
        lineBreak: false,
      });
  }
}

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
// Rapport complet
// ------------------------------------------------------------

export async function genererRapportPdf(analyse: ResultatAnalyse, options: OptionsRapport): Promise<Buffer> {
  const langue = analyse.langue;
  const couleur = choisirCouleur(options.couleur);
  const doc = new PDFDocument({
    size: "A4",
    margin: MARGE,
    bufferPages: true,
    info: {
      Title: langue === "fr" ? "Rapport d’avis clients" : "Customer review report",
      Author: options.nomOrganisation,
    },
  });
  const largeurPage = doc.page.width - 2 * MARGE;
  const { kpis, themes, serie } = analyse.donnees;

  // ----- Page 1 : en-tete, resume, indicateurs, graphiques
  let y = dessinerEntete(doc, analyse, options, couleur);
  y = dessinerResume(doc, analyse, y);
  y = dessinerIndicateurs(doc, analyse, y);

  const ecart = 24;
  const largeurGraphique = (largeurPage - ecart) / 2;
  dessinerRepartition(doc, kpis.indicateurs.repartition_notes, MARGE, y, largeurGraphique, 150, couleur, langue);
  dessinerThemes(doc, themes, MARGE + largeurGraphique + ecart, y, largeurGraphique, couleur, langue);
  y += 150 + 14;
  dessinerCourbe(doc, serie, MARGE, y, largeurPage, 150, couleur, langue);
  y += 150 + 10;

  // ----- Page 2 : points forts, points faibles, pistes (seulement avec assez d'avis)
  if (analyse.suffisant) {
    doc.addPage();
    const largeurColonne = (largeurPage - ecart) / 2;
    const finForts = dessinerColonnePoints(
      doc,
      langue === "fr" ? "Trois points forts" : "Three strengths",
      analyse.points_forts,
      langue === "fr" ? "Aucun point fort net sur cette période." : "No clear strength over this period.",
      MARGE,
      MARGE,
      largeurColonne,
      VERT,
    );
    const finFaibles = dessinerColonnePoints(
      doc,
      langue === "fr" ? "Trois points faibles" : "Three weaknesses",
      analyse.points_faibles,
      langue === "fr" ? "Aucun point faible net sur cette période." : "No clear weakness over this period.",
      MARGE + largeurColonne + ecart,
      MARGE,
      largeurColonne,
      ROUGE,
    );
    const finPistes = dessinerPistes(doc, analyse.pistes, Math.max(finForts, finFaibles) + 10, couleur, langue);
    dessinerASavoir(doc, finPistes + 10, langue);
  } else {
    dessinerASavoir(doc, y, langue);
  }

  ajouterPiedsDePage(doc, options, langue, couleur);
  return terminer(doc);
}