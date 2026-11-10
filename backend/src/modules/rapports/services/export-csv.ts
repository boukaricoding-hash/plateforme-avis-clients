import type { ColonneQuestion, LangueExport, LigneAvis, ResultatCollecte } from "./collecte-avis";

// ------------------------------------------------------------
// Export CSV (jour 21)
// ------------------------------------------------------------
// Une ligne par avis, une colonne par question, en UTF-8 avec BOM : Excel lit alors
// les accents correctement (sans BOM, "Très bien" devient "TrÃ¨s bien").
// - Separateur : point-virgule en francais (Excel francais), virgule en anglais.
// - Nombres : virgule decimale en francais, point en anglais.
// - Une cellule de texte qui commence par = + - @ serait lue comme une formule par Excel :
//   un client malveillant pourrait l'ecrire dans son commentaire. On la fait donc
//   precedee d'une apostrophe (les numeros de telephone comme +228 90 00 00 00 restent intacts).
// Les libelles ci-dessous sont aussi utilises par l'export Excel.

type DonneesCollectees = Extract<ResultatCollecte, { etat: "ok" }>;

const BOM = "\uFEFF";
const FIN_DE_LIGNE = "\r\n";

export const ENTETES_FIXES: Record<LangueExport, string[]> = {
  fr: [
    "Date et heure (UTC)",
    "Site",
    "Point de contact",
    "Type de point",
    "Questionnaire",
    "Version",
    "Langue",
    "Appareil",
    "Note globale",
    "NPS",
    "Statut",
    "Alerte",
    "Commentaire",
    "Nom",
    "Téléphone",
    "E-mail",
  ],
  en: [
    "Date and time (UTC)",
    "Site",
    "Contact point",
    "Point type",
    "Questionnaire",
    "Version",
    "Language",
    "Device",
    "Overall rating",
    "NPS",
    "Status",
    "Alert",
    "Comment",
    "Name",
    "Phone",
    "E-mail",
  ],
};

const LIBELLES_STATUT: Record<LangueExport, Record<string, string>> = {
  fr: { NOUVEAU: "Nouveau", EN_COURS: "En cours", TRAITE: "Traité", IGNORE: "Ignoré" },
  en: { NOUVEAU: "New", EN_COURS: "In progress", TRAITE: "Resolved", IGNORE: "Ignored" },
};

export function libelleStatut(statut: string, langue: LangueExport): string {
  return LIBELLES_STATUT[langue][statut] ?? statut;
}

export function libelleOuiNon(valeur: boolean, langue: LangueExport): string {
  if (langue === "en") {
    return valeur ? "Yes" : "No";
  }
  return valeur ? "Oui" : "Non";
}

// "AAAA-MM-JJ HH:MM" (heure UTC, comme Africa/Lome).
export function dateEnTexte(date: Date): string {
  return date.toISOString().slice(0, 16).replace("T", " ");
}

// ------------------------------------------------------------
// Mise en forme des cellules
// ------------------------------------------------------------

// Un texte qui commence par = + - @ (ou tabulation, retour chariot) devient une formule dans Excel.
function neutraliser(texte: string): string {
  const risque = /^[=+\-@\t\r]/.test(texte);
  const telephone = /^\+[\d\s().-]+$/.test(texte);
  return risque && !telephone ? `'${texte}` : texte;
}

// Entoure de guillemets si le texte contient le separateur, un guillemet ou un saut de ligne.
function proteger(texte: string, separateur: string): string {
  const aProteger =
    texte.includes(separateur) || texte.includes("\"") || texte.includes("\n") || texte.includes("\r");
  return aProteger ? `"${texte.replaceAll("\"", "\"\"")}"` : texte;
}

function nombreEnTexte(valeur: number, langue: LangueExport): string {
  const texte = String(Number(valeur.toFixed(2)));
  return langue === "fr" ? texte.replace(".", ",") : texte;
}

function cellule(valeur: string | number | null, langue: LangueExport, separateur: string): string {
  if (valeur === null) {
    return "";
  }
  const texte = typeof valeur === "number" ? nombreEnTexte(valeur, langue) : neutraliser(valeur);
  return proteger(texte, separateur);
}

function ligneEnCellules(ligne: LigneAvis, colonnes: ColonneQuestion[], langue: LangueExport): Array<string | number | null> {
  return [
    dateEnTexte(ligne.soumis_le),
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
    ligne.commentaire,
    ligne.contact_nom,
    ligne.contact_telephone,
    ligne.contact_email,
    ...colonnes.map((colonne) => ligne.valeurs[colonne.cle] ?? null),
  ];
}

// ------------------------------------------------------------
// Generation
// ------------------------------------------------------------

export function genererCsv(donnees: DonneesCollectees, langue: LangueExport): Buffer {
  const separateur = langue === "fr" ? ";" : ",";

  const entetes = [...ENTETES_FIXES[langue], ...donnees.colonnes.map((colonne) => colonne.libelle)];
  const lignes: string[] = [entetes.map((entete) => cellule(entete, langue, separateur)).join(separateur)];

  for (const ligne of donnees.lignes) {
    lignes.push(
      ligneEnCellules(ligne, donnees.colonnes, langue)
        .map((valeur) => cellule(valeur, langue, separateur))
        .join(separateur),
    );
  }

  return Buffer.from(BOM + lignes.join(FIN_DE_LIGNE) + FIN_DE_LIGNE, "utf8");
}