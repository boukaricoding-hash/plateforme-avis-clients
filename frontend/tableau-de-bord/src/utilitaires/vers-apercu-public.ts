import type {
  BrouillonQuestionnaire,
  QuestionEditee,
  TexteEdite,
} from '../hooks/utiliser-editeur-questionnaire'
import type { TypeQuestion } from '../types/tableau-de-bord'

// Transforme le brouillon de l'editeur (jour 19) en questionnaire au format de la page d'avis
// (QuestionnairePublic, voir application-avis-public/src/types/avis-public.ts).
// Le resultat est envoye a l'apercu (iframe /apercu) par postMessage, a chaque modification.
// Les regles sont celles du serveur a l'enregistrement et de GET /public/q/{code} :
// - un texte anglais vide est absent ; un texte facultatif sans francais devient null ;
// - etoiles et emojis : de 1 a 5, NPS : de 0 a 10, echelle : les valeurs du brouillon ;
// - les options et les libelles d'extremites ne servent qu'aux types concernes.
// Rien ici n'est envoye au serveur : c'est seulement ce que verrait le client.

// Les types sont recopies ici : le tableau de bord et la page d'avis sont deux applications separees.
export type TexteApercu = {
  fr: string
  en?: string
}

export type QuestionApercu = {
  id: string
  ordre: number
  type: TypeQuestion
  libelle: TexteApercu
  aide: TexteApercu | null
  obligatoire: boolean
  options: TexteApercu[] | null
  echelle_min: number | null
  echelle_max: number | null
  libelles_extremites: { min: TexteApercu; max: TexteApercu } | null
}

export type DonneesApercu = {
  point_contact: { nom: string; type: string }
  organisation: {
    nom: string
    logo_url: string | null
    couleur_principale: string | null
    langue_defaut: string
  }
  questionnaire: {
    version_id: string
    titre: TexteApercu
    message_accueil: TexteApercu | null
    message_remerciement: TexteApercu | null
    langue_defaut: string
    questions: QuestionApercu[]
  }
}

// Ce que l'apercu montre autour du questionnaire : l'organisation et un point de contact d'exemple.
export type ContexteApercu = {
  organisationNom: string
  logoUrl: string | null
  couleurPrincipale: string | null
  // Par exemple "12" et "table" pour afficher "Table 12".
  pointContactNom: string
  pointContactType: string
}

// Identifiant de version de l'apercu : il n'existe pas cote serveur (aucun avis ne part de l'apercu).
const VERSION_APERCU = 'apercu'

// Echelle par defaut quand les nombres tapes ne sont pas encore valides.
const ECHELLE_PAR_DEFAUT = { min: 1, max: 5 }

function versTexte(texte: TexteEdite): TexteApercu {
  const fr = texte.fr.trim()
  const en = texte.en.trim()
  return en === '' ? { fr } : { fr, en }
}

// Un texte facultatif sans francais n'existe pas pour le client.
function versTexteFacultatif(texte: TexteEdite): TexteApercu | null {
  return texte.fr.trim() === '' ? null : versTexte(texte)
}

function estQuestionAChoix(type: TypeQuestion): boolean {
  return type === 'CHOIX_UNIQUE' || type === 'CHOIX_MULTIPLE'
}

// Les nombres de l'echelle restent en texte dans l'editeur : on ne les utilise que s'ils sont valides.
function limitesEchelle(question: QuestionEditee): { min: number; max: number } {
  if (question.echelleMin.trim() === '' || question.echelleMax.trim() === '') {
    return ECHELLE_PAR_DEFAUT
  }
  const min = Number(question.echelleMin)
  const max = Number(question.echelleMax)
  if (Number.isInteger(min) && Number.isInteger(max) && min < max) {
    return { min, max }
  }
  return ECHELLE_PAR_DEFAUT
}

function limitesQuestion(question: QuestionEditee): { min: number | null; max: number | null } {
  switch (question.type) {
    case 'ETOILES':
    case 'EMOJIS':
      return { min: 1, max: 5 }
    case 'NPS':
      return { min: 0, max: 10 }
    case 'ECHELLE':
      return limitesEchelle(question)
    default:
      return { min: null, max: null }
  }
}

// Les deux libelles d'extremites ou aucun (comme a l'enregistrement), pour une echelle seulement.
function extremitesQuestion(question: QuestionEditee): QuestionApercu['libelles_extremites'] {
  if (question.type !== 'ECHELLE') {
    return null
  }
  const minimum = versTexteFacultatif(question.extremiteMin)
  const maximum = versTexteFacultatif(question.extremiteMax)
  return minimum !== null && maximum !== null ? { min: minimum, max: maximum } : null
}

// Une option sans texte francais n'est pas montree : elle ferait un bouton vide.
function optionsQuestion(question: QuestionEditee): TexteApercu[] | null {
  if (!estQuestionAChoix(question.type)) {
    return null
  }
  return question.options
    .filter((option) => option.texte.fr.trim() !== '')
    .map((option) => versTexte(option.texte))
}

function versQuestionApercu(question: QuestionEditee, index: number): QuestionApercu {
  const limites = limitesQuestion(question)
  return {
    // L'identifiant d'affichage de l'editeur sert d'identifiant : il ne change pas quand on tape.
    id: question.cle,
    ordre: index + 1,
    type: question.type,
    libelle: versTexte(question.libelle),
    aide: versTexteFacultatif(question.aide),
    obligatoire: question.obligatoire,
    options: optionsQuestion(question),
    echelle_min: limites.min,
    echelle_max: limites.max,
    libelles_extremites: extremitesQuestion(question),
  }
}

export function versApercuPublic(
  brouillon: BrouillonQuestionnaire,
  contexte: ContexteApercu,
): DonneesApercu {
  return {
    point_contact: { nom: contexte.pointContactNom, type: contexte.pointContactType },
    organisation: {
      nom: contexte.organisationNom,
      logo_url: contexte.logoUrl,
      couleur_principale: contexte.couleurPrincipale,
      langue_defaut: brouillon.langueDefaut,
    },
    questionnaire: {
      version_id: VERSION_APERCU,
      titre: versTexte(brouillon.titre),
      message_accueil: versTexteFacultatif(brouillon.messageAccueil),
      message_remerciement: versTexteFacultatif(brouillon.messageRemerciement),
      langue_defaut: brouillon.langueDefaut,
      questions: brouillon.questions.map(versQuestionApercu),
    },
  }
}