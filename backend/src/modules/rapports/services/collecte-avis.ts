import type { Prisma, TypeQuestion } from "../../../../generated/prisma/client";
import { prisma } from "../../../configuration/base-de-donnees";
import { construireFiltre } from "../../avis/services/avis";
import type { FiltresAvis } from "../../avis/validations/avis";
import type { FiltresExport } from "../validations/exports";

// ------------------------------------------------------------
// Collecte des avis a exporter (jour 21)
// ------------------------------------------------------------
// Lit les avis filtres par paquets, avec leurs reponses, et les met en forme pour les
// exports csv et xlsx : une ligne par avis, une colonne par question.
// - Le filtre est celui de la liste des avis (construireFiltre) : memes filtres, meme perimetre.
// - Les coordonnees du client ne sortent que s'il a coche la case de consentement.
// - Au dela de LIMITE_AVIS_EXPORT avis, on ne lit rien : l'utilisateur doit reduire sa periode.

export const LIMITE_AVIS_EXPORT = 50_000;
const TAILLE_PAQUET = 500;

export type LangueExport = "fr" | "en";

// Une colonne = une question. Deux questions de versions differentes avec le meme texte
// et le meme type partagent la meme colonne.
export type ColonneQuestion = {
  cle: string;
  libelle: string;
  type: TypeQuestion;
};

// Nombre pour les notes (le tableur peut calculer dessus), texte pour le reste.
export type ValeurCellule = string | number | null;

export type LigneAvis = {
  id: string;
  soumis_le: Date;
  site: string;
  point_contact: string;
  type_point: string;
  questionnaire: string;
  version: number;
  langue: string;
  appareil: string | null;
  note_globale: number | null;
  nps: number | null;
  statut: string;
  en_alerte: boolean;
  commentaire: string | null;
  contact_nom: string | null;
  contact_telephone: string | null;
  contact_email: string | null;
  // Valeur de chaque question, par cle de colonne.
  valeurs: Record<string, ValeurCellule>;
};

export type ResultatCollecte =
  | { etat: "ok"; total: number; colonnes: ColonneQuestion[]; lignes: LigneAvis[] }
  | { etat: "trop_volumineux"; total: number };

// ------------------------------------------------------------
// Lecture des textes multilingues et des options
// ------------------------------------------------------------

// Texte d'un champ { fr, en } selon la langue ; francais si l'anglais manque ; texte simple accepte.
function texteLangue(valeur: unknown, langue: LangueExport): string {
  if (typeof valeur === "string") {
    return valeur;
  }
  if (valeur !== null && typeof valeur === "object" && !Array.isArray(valeur)) {
    const objet = valeur as Record<string, unknown>;
    const choisi = objet[langue];
    if (typeof choisi === "string" && choisi.trim() !== "") {
      return choisi;
    }
    const francais = objet["fr"];
    if (typeof francais === "string") {
      return francais;
    }
  }
  return "";
}

// Valeur enregistree d'une option : meme regle que la page d'avis ("valeur", "code", "id", puis "fr").
function valeurDeOption(option: unknown): string | null {
  if (typeof option === "string") {
    return option;
  }
  if (option !== null && typeof option === "object" && !Array.isArray(option)) {
    const objet = option as Record<string, unknown>;
    for (const nom of ["valeur", "code", "id", "fr"]) {
      const v = objet[nom];
      if (typeof v === "string") {
        return v;
      }
      if (typeof v === "number") {
        return String(v);
      }
    }
  }
  return null;
}

// Texte a afficher pour un choix enregistre : le libelle de l'option dans la langue, sinon la valeur brute.
function libelleChoix(options: unknown, valeur: string, langue: LangueExport): string {
  if (Array.isArray(options)) {
    for (const option of options) {
      if (valeurDeOption(option) === valeur) {
        const texte = texteLangue(option, langue);
        return texte !== "" ? texte : valeur;
      }
    }
  }
  return valeur;
}

// Contenu de la cellule d'une reponse.
function valeurCellule(
  reponse: {
    valeur_numerique: number | null;
    valeur_texte: string | null;
    valeur_choix: Prisma.JsonValue;
  },
  question: { type: TypeQuestion; options: Prisma.JsonValue },
  langue: LangueExport,
): ValeurCellule {
  if (reponse.valeur_numerique !== null) {
    if (question.type === "OUI_NON") {
      if (reponse.valeur_numerique === 1) {
        return langue === "en" ? "Yes" : "Oui";
      }
      return langue === "en" ? "No" : "Non";
    }
    return reponse.valeur_numerique;
  }
  const choix = reponse.valeur_choix;
  if (typeof choix === "string") {
    return libelleChoix(question.options, choix, langue);
  }
  if (Array.isArray(choix)) {
    const textes = choix
      .filter((element): element is string => typeof element === "string")
      .map((element) => libelleChoix(question.options, element, langue));
    return textes.length > 0 ? textes.join(" | ") : null;
  }
  if (reponse.valeur_texte !== null && reponse.valeur_texte !== "") {
    return reponse.valeur_texte;
  }
  return null;
}

// ------------------------------------------------------------
// Collecte
// ------------------------------------------------------------

const selectionAvis = {
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
  site: { select: { nom: true } },
  point_contact: { select: { nom: true, type: true } },
  version: { select: { numero: true, questionnaire: { select: { titre: true } } } },
  alerte: { select: { id: true } },
  reponses: {
    select: {
      valeur_numerique: true,
      valeur_texte: true,
      valeur_choix: true,
      question: { select: { type: true, ordre: true, libelle: true, options: true } },
    },
  },
} satisfies Prisma.AvisSelect;

// Colonne en cours de construction : on garde le plus petit "ordre" vu et le rang d'apparition.
type ColonneEnCours = ColonneQuestion & { ordre: number; rang: number };

export async function collecterAvis(
  organisationId: string,
  perimetre: string[] | null,
  filtres: FiltresExport,
  langue: LangueExport,
): Promise<ResultatCollecte> {
  // Memes filtres que la liste des avis : les champs de tri et de page ne servent pas ici.
  const filtresAvis: FiltresAvis = { ...filtres, tri: "soumis_le", ordre: "desc", page: 1, limite: TAILLE_PAQUET };
  const where = construireFiltre(organisationId, perimetre, filtresAvis);
  if (where === null) {
    return { etat: "ok", total: 0, colonnes: [], lignes: [] };
  }

  const total = await prisma.avis.count({ where });
  if (total > LIMITE_AVIS_EXPORT) {
    return { etat: "trop_volumineux", total };
  }

  const colonnes = new Map<string, ColonneEnCours>();
  const lignes: LigneAvis[] = [];
  let curseur: string | undefined;

  for (;;) {
    const paquet = await prisma.avis.findMany({
      where,
      // Les plus recents d'abord ; l'identifiant departage les egalites (le curseur reste stable).
      orderBy: [{ soumis_le: "desc" }, { id: "asc" }],
      take: TAILLE_PAQUET,
      ...(curseur !== undefined ? { cursor: { id: curseur }, skip: 1 } : {}),
      select: selectionAvis,
    });

    for (const avis of paquet) {
      const valeurs: Record<string, ValeurCellule> = {};

      for (const reponse of avis.reponses) {
        const question = reponse.question;
        const texteFr = texteLangue(question.libelle, "fr").trim().toLowerCase();
        const cle = `${question.type}:${texteFr}`;

        const existante = colonnes.get(cle);
        if (existante === undefined) {
          colonnes.set(cle, {
            cle,
            libelle: texteLangue(question.libelle, langue),
            type: question.type,
            ordre: question.ordre,
            rang: colonnes.size,
          });
        } else if (question.ordre < existante.ordre) {
          existante.ordre = question.ordre;
        }

        valeurs[cle] = valeurCellule(reponse, question, langue);
      }

      lignes.push({
        id: avis.id,
        soumis_le: avis.soumis_le,
        site: avis.site.nom,
        point_contact: avis.point_contact.nom,
        type_point: avis.point_contact.type,
        questionnaire: texteLangue(avis.version.questionnaire.titre, langue),
        version: avis.version.numero,
        langue: avis.langue,
        appareil: avis.appareil,
        note_globale: avis.note_globale,
        nps: avis.nps,
        statut: avis.statut_traitement,
        en_alerte: avis.alerte !== null,
        commentaire: avis.commentaire,
        // Coordonnees : seulement avec le consentement du client.
        contact_nom: avis.consentement ? avis.contact_nom : null,
        contact_telephone: avis.consentement ? avis.contact_tel : null,
        contact_email: avis.consentement ? avis.contact_email : null,
        valeurs,
      });
    }

    const dernier = paquet.at(-1);
    if (paquet.length < TAILLE_PAQUET || dernier === undefined) {
      break;
    }
    curseur = dernier.id;
  }

  const colonnesTriees: ColonneQuestion[] = [...colonnes.values()]
    .sort((a, b) => a.ordre - b.ordre || a.rang - b.rang)
    .map(({ cle, libelle, type }) => ({ cle, libelle, type }));

  return { etat: "ok", total, colonnes: colonnesTriees, lignes };
}