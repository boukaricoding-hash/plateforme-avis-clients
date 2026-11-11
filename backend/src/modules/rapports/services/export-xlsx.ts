import ExcelJS from "exceljs";
import type { ColonneQuestion, LangueExport, LigneAvis, ResultatCollecte } from "./collecte-avis";
import { ENTETES_FIXES, libelleOuiNon, libelleStatut } from "./export-csv";

// ------------------------------------------------------------
// Export Excel (jour 21)
// ------------------------------------------------------------
// Feuille "Avis" : une ligne par avis, une colonne par question (memes colonnes que le csv).
// Feuille "Analyse" (facultative) : les conclusions du robot, ecrites par analyse.ts.
// - Les notes sont des nombres (Excel peut calculer dessus) ; la date est une vraie date.
// - Un texte qui commence par = est enregistre comme du texte par ExcelJS, jamais comme
//   une formule : pas besoin de la neutralisation du csv.
// - Un seul classeur en memoire : 50 000 avis (limite de collecte-avis.ts) restent legers.

type DonneesCollectees = Extract<ResultatCollecte, { etat: "ok" }>;

// Contenu de la feuille "Analyse" : des sections, chacune avec ses lignes de texte.
// analyse.ts (fichier 5) fabrique cette forme a partir des services du tableau de bord.
export type ContenuAnalyse = {
  titre: string;
  sections: Array<{ titre: string; lignes: string[] }>;
};

const NOMS_FEUILLES: Record<LangueExport, { avis: string; analyse: string }> = {
  fr: { avis: "Avis", analyse: "Analyse" },
  en: { avis: "Reviews", analyse: "Analysis" },
};

const FORMAT_DATE = "yyyy-mm-dd hh:mm";
const LONGUEUR_MAX_CELLULE = 32000; // Excel refuse plus de 32 767 caracteres par cellule
const COULEUR_ENTETE = "FF1F3A5F"; // bleu marine
const COULEUR_SECTION = "FFE8EDF4";

// Position (a partir de 0) des colonnes fixes qui demandent un format particulier.
const INDEX_DATE = 0;
const INDEX_COMMENTAIRE = 12;
const INDEX_NOMBRES = [5, 8, 9]; // version, note globale, NPS

function texteCellule(valeur: string): string {
  return valeur.length > LONGUEUR_MAX_CELLULE ? valeur.slice(0, LONGUEUR_MAX_CELLULE) : valeur;
}

function ligneEnCellules(
  ligne: LigneAvis,
  colonnes: ColonneQuestion[],
  langue: LangueExport,
): Array<string | number | Date | null> {
  return [
    ligne.soumis_le,
    ligne.site,
    ligne.point_contact,
    ligne.type_point,
    ligne.questionnaire,
    ligne.version,
    ligne.langue,
    ligne.appareil,
    ligne.note_globale,
    ligne.nps,
    libelleStatut(ligne.statut, langue),
    libelleOuiNon(ligne.en_alerte, langue),
    ligne.commentaire === null ? null : texteCellule(ligne.commentaire),
    ligne.contact_nom,
    ligne.contact_telephone,
    ligne.contact_email,
    ...colonnes.map((colonne) => {
      const valeur = ligne.valeurs[colonne.cle] ?? null;
      return typeof valeur === "string" ? texteCellule(valeur) : valeur;
    }),
  ];
}

// ------------------------------------------------------------
// Feuille des avis
// ------------------------------------------------------------

function definirColonne(entete: string, index: number): Partial<ExcelJS.Column> {
  const colonne: Partial<ExcelJS.Column> = {
    header: entete,
    width: Math.min(Math.max(entete.length + 4, 12), 40),
  };
  if (index === INDEX_DATE) {
    colonne.width = 18;
    colonne.style = { numFmt: FORMAT_DATE };
  } else if (index === INDEX_COMMENTAIRE) {
    colonne.width = 60;
    colonne.style = { alignment: { vertical: "top", wrapText: true } };
  } else if (INDEX_NOMBRES.includes(index)) {
    colonne.style = { alignment: { horizontal: "center" } };
  }
  return colonne;
}

function ajouterFeuilleAvis(classeur: ExcelJS.Workbook, donnees: DonneesCollectees, langue: LangueExport): void {
  const feuille = classeur.addWorksheet(NOMS_FEUILLES[langue].avis, {
    views: [{ state: "frozen", xSplit: 3, ySplit: 1 }],
  });

  const entetes = [...ENTETES_FIXES[langue], ...donnees.colonnes.map((colonne) => colonne.libelle)];
  feuille.columns = entetes.map((entete, index) => definirColonne(entete, index));

  for (const ligne of donnees.lignes) {
    feuille.addRow(ligneEnCellules(ligne, donnees.colonnes, langue));
  }

  // En-tete : gras, blanc sur bleu marine, texte a la ligne.
  const ligneEntete = feuille.getRow(1);
  ligneEntete.height = 32;
  ligneEntete.eachCell((cellule) => {
    cellule.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cellule.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COULEUR_ENTETE } };
    cellule.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });

  feuille.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: entetes.length } };
}

// ------------------------------------------------------------
// Feuille d'analyse
// ------------------------------------------------------------

function ajouterFeuilleAnalyse(classeur: ExcelJS.Workbook, analyse: ContenuAnalyse, langue: LangueExport): void {
  const feuille = classeur.addWorksheet(NOMS_FEUILLES[langue].analyse);
  feuille.columns = [{ width: 120 }];

  const titre = feuille.addRow([texteCellule(analyse.titre)]);
  titre.font = { bold: true, size: 14 };
  titre.height = 26;
  feuille.addRow([]);

  for (const section of analyse.sections) {
    const entete = feuille.addRow([texteCellule(section.titre)]);
    entete.font = { bold: true, size: 12 };
    entete.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: COULEUR_SECTION } };

    for (const texte of section.lignes) {
      const ligne = feuille.addRow([texteCellule(texte)]);
      ligne.getCell(1).alignment = { vertical: "top", wrapText: true };
    }
    feuille.addRow([]);
  }
}

// ------------------------------------------------------------
// Generation
// ------------------------------------------------------------

export async function genererXlsx(
  donnees: DonneesCollectees,
  langue: LangueExport,
  analyse: ContenuAnalyse | null,
): Promise<Buffer> {
  const classeur = new ExcelJS.Workbook();
  classeur.creator = "DATA TRACE SERVICE";
  classeur.created = new Date();

  ajouterFeuilleAvis(classeur, donnees, langue);
  if (analyse !== null) {
    ajouterFeuilleAnalyse(classeur, analyse, langue);
  }

  const contenu = await classeur.xlsx.writeBuffer();
  return Buffer.from(contenu);
}