import { prisma } from "../../../configuration/base-de-donnees";
import type { CorpsAvis } from "../validations/avis";
import type { ContexteEnvoiAvis, QuestionPourEnvoi } from "./questionnaire-public";

export type ErreurChamp = { champ: string; message: string };

export type ResultatCreationAvis =
  | { etat: "ok"; avis_id: string }
  | { etat: "invalide"; erreurs: ErreurChamp[] };

type ValeurValidee = {
  valeur_numerique?: number;
  valeur_texte?: string;
  valeur_choix?: string | string[];
};

type ResultatValeur = { ok: true; valeur: ValeurValidee } | { ok: false; message: string };

// Les options d'une question peuvent etre une liste de textes
// ou une liste d'objets avec "valeur", "code" ou "id".
function valeursOptions(options: unknown): string[] {
  if (!Array.isArray(options)) {
    return [];
  }
  const valeurs: string[] = [];
  for (const option of options) {
    if (typeof option === "string") {
      valeurs.push(option);
    } else if (option !== null && typeof option === "object") {
      const objet = option as Record<string, unknown>;
      for (const cle of ["valeur", "code", "id"]) {
        const v = objet[cle];
        if (typeof v === "string") {
          valeurs.push(v);
          break;
        }
        if (typeof v === "number") {
          valeurs.push(String(v));
          break;
        }
      }
    }
  }
  return valeurs;
}

function estVide(valeur: unknown): boolean {
  if (typeof valeur === "string") {
    return valeur.trim() === "";
  }
  if (Array.isArray(valeur)) {
    return valeur.length === 0;
  }
  return false;
}

function entierDans(valeur: unknown, min: number, max: number): number | null {
  if (typeof valeur !== "number" || !Number.isInteger(valeur)) {
    return null;
  }
  if (valeur < min || valeur > max) {
    return null;
  }
  return valeur;
}

function validerValeur(question: QuestionPourEnvoi, valeur: unknown): ResultatValeur {
  switch (question.type) {
    case "ETOILES":
    case "EMOJIS": {
      const note = entierDans(valeur, 1, 5);
      if (note === null) {
        return { ok: false, message: "La note doit etre un entier de 1 a 5." };
      }
      return { ok: true, valeur: { valeur_numerique: note } };
    }
    case "NPS": {
      const note = entierDans(valeur, 0, 10);
      if (note === null) {
        return { ok: false, message: "La note doit etre un entier de 0 a 10." };
      }
      return { ok: true, valeur: { valeur_numerique: note } };
    }
    case "ECHELLE": {
      const min = question.echelle_min ?? 1;
      const max = question.echelle_max ?? 5;
      const note = entierDans(valeur, min, max);
      if (note === null) {
        return { ok: false, message: `La valeur doit etre un entier de ${min} a ${max}.` };
      }
      return { ok: true, valeur: { valeur_numerique: note } };
    }
    case "OUI_NON": {
      if (typeof valeur !== "boolean") {
        return { ok: false, message: "La reponse doit etre oui ou non." };
      }
      return { ok: true, valeur: { valeur_numerique: valeur ? 1 : 0 } };
    }
    case "CHOIX_UNIQUE": {
      if (typeof valeur !== "string" || !valeursOptions(question.options).includes(valeur)) {
        return { ok: false, message: "Ce choix n'est pas propose." };
      }
      return { ok: true, valeur: { valeur_choix: valeur } };
    }
    case "CHOIX_MULTIPLE": {
      if (!Array.isArray(valeur) || valeur.some((v) => typeof v !== "string")) {
        return { ok: false, message: "Les choix doivent etre une liste de textes." };
      }
      const choix = valeur as string[];
      if (new Set(choix).size !== choix.length) {
        return { ok: false, message: "Un meme choix ne peut pas etre repete." };
      }
      const permis = valeursOptions(question.options);
      if (choix.some((c) => !permis.includes(c))) {
        return { ok: false, message: "Un des choix n'est pas propose." };
      }
      return { ok: true, valeur: { valeur_choix: choix } };
    }
    case "TEXTE_LIBRE": {
      if (typeof valeur !== "string") {
        return { ok: false, message: "La reponse doit etre un texte." };
      }
      return { ok: true, valeur: { valeur_texte: valeur.trim() } };
    }
    default:
      return { ok: false, message: "Type de question non pris en charge." };
  }
}

// Enregistre un avis et ses reponses, apres avoir tout verifie.
// Rien n'est enregistre si une seule reponse est invalide.
export async function creerAvis(
  contexte: ContexteEnvoiAvis,
  corps: CorpsAvis,
  appareil: string | null,
): Promise<ResultatCreationAvis> {
  const erreurs: ErreurChamp[] = [];

  // 1. Reponses envoyees, rangees par question.
  const idsConnus = new Set(contexte.questions.map((q) => q.id));
  const parQuestion = new Map<string, unknown>();
  for (const reponse of corps.reponses) {
    if (!idsConnus.has(reponse.question_id)) {
      erreurs.push({
        champ: `reponses.${reponse.question_id}`,
        message: "Cette question n'appartient pas a ce questionnaire.",
      });
      continue;
    }
    if (parQuestion.has(reponse.question_id)) {
      erreurs.push({
        champ: `reponses.${reponse.question_id}`,
        message: "Cette question a ete repondue plusieurs fois.",
      });
      continue;
    }
    parQuestion.set(reponse.question_id, reponse.valeur);
  }

  // 2. Verification question par question, dans l'ordre du questionnaire.
  const aEnregistrer: Array<ValeurValidee & { organisation_id: string; question_id: string }> = [];
  const notesSur5: number[] = [];
  let nps: number | null = null;

  for (const question of contexte.questions) {
    const champ = `reponses.${question.id}`;
    const envoyee = parQuestion.get(question.id);

    if (envoyee === undefined || estVide(envoyee)) {
      if (question.obligatoire) {
        erreurs.push({ champ, message: "Cette question est obligatoire." });
      }
      continue;
    }

    const resultat = validerValeur(question, envoyee);
    if (!resultat.ok) {
      erreurs.push({ champ, message: resultat.message });
      continue;
    }

    aEnregistrer.push({
      organisation_id: contexte.organisation_id,
      question_id: question.id,
      ...resultat.valeur,
    });

    const numerique = resultat.valeur.valeur_numerique;
    if (numerique !== undefined) {
      if (question.type === "ETOILES" || question.type === "EMOJIS") {
        notesSur5.push(numerique);
      } else if (question.type === "ECHELLE") {
        const min = question.echelle_min ?? 1;
        const max = question.echelle_max ?? 5;
        if (max > min) {
          notesSur5.push(((numerique - min) / (max - min)) * 4 + 1);
        }
      } else if (question.type === "NPS" && nps === null) {
        nps = numerique;
      }
    }
  }

  if (erreurs.length > 0) {
    return { etat: "invalide", erreurs };
  }

  // 3. Calculs.
  const noteGlobale =
    notesSur5.length > 0
      ? Math.round((notesSur5.reduce((somme, n) => somme + n, 0) / notesSur5.length) * 100) / 100
      : null;
  const commentaire =
    corps.commentaire !== undefined && corps.commentaire.length > 0 ? corps.commentaire : null;

  // 4. Enregistrement en une seule operation : l'avis et toutes ses reponses.
  const avis = await prisma.avis.create({
    data: {
      organisation_id: contexte.organisation_id,
      site_id: contexte.site_id,
      point_contact_id: contexte.point_contact_id,
      version_id: contexte.version_id,
      langue: corps.langue,
      appareil,
      note_globale: noteGlobale,
      nps,
      commentaire,
      reponses: { create: aEnregistrer },
    },
    select: { id: true },
  });

  return { etat: "ok", avis_id: avis.id };
}