import { useCallback, useEffect, useMemo, useState } from 'react'
import { ErreurService } from '../services/api'
import {
  creerQuestionnaire,
  lireQuestionnaire,
  listerThemes,
  modifierQuestionnaire,
} from '../services/questionnaires'
import type { ValeursTexte } from '../traductions/contexte-langue'
import type { TexteMultilingue } from '../types/avis'
import type {
  CorpsQuestionnaire,
  FicheQuestionnaire,
  LangueQuestionnaire,
  QuestionEnvoyee,
  QuestionQuestionnaire,
  TexteEnvoye,
  ThemeSecteur,
} from '../types/questionnaires'
import type { TypeQuestion } from '../types/tableau-de-bord'
import { utiliserUtilisateur } from './utiliser-utilisateur'

// Toutes les donnees de l'editeur de questionnaire (ecran E10, jour 19), au meme endroit :
// - le brouillon en cours de modification (titre, messages, questions, options, echelles) ;
// - les themes du secteur, pour rattacher une question ;
// - les actions : ajouter, supprimer, dupliquer et deplacer une question, changer son type,
//   gerer ses options, et enregistrer.
// Le hook ne dessine rien : la page et les composants (champ bilingue, carte de question) lui
// donnent les saisies et affichent ce qu'il renvoie.
// - id null : creation. Le brouillon part avec une seule question vide (etoiles).
// - id donne : modification. Le brouillon est lu depuis la fiche du questionnaire.
// La page doit recreer l'ecran (key) quand l'identifiant change : le hook ne relit pas la fiche
// si l'id change sans que l'ecran soit recree.
// Seul le Responsable modifie les questionnaires (acces = 'aucun' pour les autres : aucun appel,
// la page doit les renvoyer ailleurs).
// Les verifications sont les memes que celles du serveur (titre, 1 a 50 questions, 2 a 20 options,
// minimum inferieur au maximum) : le serveur reste le dernier juge.
// Une session expiree (401) renvoie a la page de connexion.

export const NOMBRE_MAX_QUESTIONS = 50
export const NOMBRE_MIN_OPTIONS = 2
export const NOMBRE_MAX_OPTIONS = 20

const PREFIXE_ERREURS = 'questionnaires.editeur.erreurs.'

export type AccesEditeur = 'responsable' | 'aucun'

export type LangueTexte = 'fr' | 'en'

// Un texte en deux langues : le francais est obligatoire, l'anglais est facultatif (chaine vide = absent).
export type TexteEdite = {
  fr: string
  en: string
}

// Une option de reponse. cle sert seulement d'identifiant d'affichage (jamais envoyee au serveur).
export type OptionEditee = {
  cle: string
  texte: TexteEdite
}

// Une question en cours de modification. Les nombres de l'echelle restent en texte pour laisser
// la personne taper librement ; ils sont verifies a l'enregistrement.
export type QuestionEditee = {
  // Identifiant d'affichage, propre a cet ecran (pas celui du serveur).
  cle: string
  type: TypeQuestion
  libelle: TexteEdite
  aide: TexteEdite
  obligatoire: boolean
  // Identifiant du theme ; chaine vide = aucun theme.
  themeId: string
  // Utilisees seulement pour un choix unique ou multiple (gardees si on change de type puis on revient).
  options: OptionEditee[]
  // Utilises seulement pour une echelle.
  echelleMin: string
  echelleMax: string
  extremiteMin: TexteEdite
  extremiteMax: TexteEdite
}

export type BrouillonQuestionnaire = {
  titre: TexteEdite
  messageAccueil: TexteEdite
  messageRemerciement: TexteEdite
  langueDefaut: LangueQuestionnaire
  questions: QuestionEditee[]
}

export type ChampGeneral = 'titre' | 'messageAccueil' | 'messageRemerciement'

// Champs de texte d'une question
export type ChampTexteQuestion = 'libelle' | 'aide' | 'extremiteMin' | 'extremiteMax'

// Champs simples d'une question (le type et les options ont leurs propres actions)
export type ChangementsQuestion = Partial<Pick<QuestionEditee, 'obligatoire' | 'themeId' | 'echelleMin' | 'echelleMax'>>

// Erreur d'enregistrement : cle de texte a traduire avec t(cle, valeurs).
export type ErreurEditeur = {
  cle: string
  valeurs?: ValeursTexte
}

// Derniere sauvegarde reussie : cree, modifie, ou modifie avec une nouvelle version
// (le questionnaire avait deja des avis). numero = numero de la version enregistree (null si inconnu).
export type ReussiteEnregistrement = {
  type: 'cree' | 'modifie' | 'nouvelleVersion'
  numero: number | null
}

export type ActionsEditeur = {
  modifierGeneral: (champ: ChampGeneral, langue: LangueTexte, valeur: string) => void
  changerLangueDefaut: (langue: LangueQuestionnaire) => void
  // Ajoute une question vide a la fin (sans effet a 50 questions).
  ajouterQuestion: () => void
  supprimerQuestion: (cle: string) => void
  // Copie la question juste en dessous (sans effet a 50 questions).
  dupliquerQuestion: (cle: string) => void
  // sens -1 : monter, sens 1 : descendre (sans effet en haut ou en bas de la liste).
  deplacerQuestion: (cle: string, sens: -1 | 1) => void
  changerType: (cle: string, type: TypeQuestion) => void
  modifierTexteQuestion: (cle: string, champ: ChampTexteQuestion, langue: LangueTexte, valeur: string) => void
  modifierQuestion: (cle: string, changements: ChangementsQuestion) => void
  // Ajoute une option vide (sans effet a 20 options).
  ajouterOption: (cleQuestion: string) => void
  // Retire une option (sans effet s'il n'en reste que 2).
  supprimerOption: (cleQuestion: string, cleOption: string) => void
  modifierOption: (cleQuestion: string, cleOption: string, langue: LangueTexte, valeur: string) => void
}

export type EnregistrementEditeur = {
  enCours: boolean
  // Erreur de la derniere tentative (verification locale ou reponse du serveur) ; null = aucune.
  erreur: ErreurEditeur | null
  reussite: ReussiteEnregistrement | null
  // Verifie puis enregistre. Renvoie l'identifiant du questionnaire, ou null si ca a echoue.
  // Apres un enregistrement reussi, le brouillon est relu depuis la reponse du serveur.
  enregistrer: () => Promise<string | null>
}

export type ResultatEditeurQuestionnaire = {
  acces: AccesEditeur
  mode: 'creation' | 'modification'
  // Vrai tant que la fiche n'est pas arrivee (toujours faux en creation).
  chargement: boolean
  // Erreur du chargement de la fiche (null = tout va bien). Statut 404 : le questionnaire n'existe plus.
  erreurChargement: ErreurService | null
  // Relance les chargements (bouton "Reessayer").
  recharger: () => void
  // Brouillon en cours ; null tant que la fiche n'est pas chargee.
  brouillon: BrouillonQuestionnaire | null
  // Numero de la derniere version enregistree ; null en creation ou si le questionnaire n'en a pas.
  version: number | null
  // Vrai si le brouillon est different de ce qui est enregistre.
  nonEnregistre: boolean
  // Themes du secteur ; null tant qu'ils ne sont pas charges. Un echec ne bloque pas l'editeur.
  themes: ThemeSecteur[] | null
  erreurThemes: boolean
  enregistrement: EnregistrementEditeur
  actions: ActionsEditeur
}

// ------------------------------------------------------------
// Etat du brouillon
// ------------------------------------------------------------

type Etat = {
  brouillon: BrouillonQuestionnaire
  // Brouillon tel qu'enregistre, en texte : sert a savoir si quelque chose a change.
  initial: string
  version: number | null
}

let compteurCles = 0

function nouvelleCle(): string {
  compteurCles += 1
  return `cle-${compteurCles}`
}

function texteVide(): TexteEdite {
  return { fr: '', en: '' }
}

function estQuestionAChoix(type: TypeQuestion): boolean {
  return type === 'CHOIX_UNIQUE' || type === 'CHOIX_MULTIPLE'
}

function optionVide(): OptionEditee {
  return { cle: nouvelleCle(), texte: texteVide() }
}

// Une question a choix a toujours au moins 2 options a l'ecran
function completerOptions(options: OptionEditee[]): OptionEditee[] {
  const resultat = [...options]
  while (resultat.length < NOMBRE_MIN_OPTIONS) {
    resultat.push(optionVide())
  }
  return resultat
}

function questionVide(): QuestionEditee {
  return {
    cle: nouvelleCle(),
    type: 'ETOILES',
    libelle: texteVide(),
    aide: texteVide(),
    obligatoire: true,
    themeId: '',
    options: [],
    echelleMin: '1',
    echelleMax: '5',
    extremiteMin: texteVide(),
    extremiteMax: texteVide(),
  }
}

function versTexteEdite(texte: TexteMultilingue | null | undefined): TexteEdite {
  return { fr: texte?.fr ?? '', en: texte?.en ?? '' }
}

function questionDepuisServeur(question: QuestionQuestionnaire): QuestionEditee {
  const estEchelle = question.type === 'ECHELLE'
  const options = (question.options ?? []).map((texte) => ({ cle: nouvelleCle(), texte: versTexteEdite(texte) }))
  return {
    cle: nouvelleCle(),
    type: question.type,
    libelle: versTexteEdite(question.libelle),
    aide: versTexteEdite(question.aide),
    obligatoire: question.obligatoire,
    themeId: question.theme !== null ? question.theme.id : '',
    options: estQuestionAChoix(question.type) ? completerOptions(options) : options,
    echelleMin: estEchelle && question.echelle_min !== null ? String(question.echelle_min) : '1',
    echelleMax: estEchelle && question.echelle_max !== null ? String(question.echelle_max) : '5',
    extremiteMin: versTexteEdite(question.libelles_extremites?.min),
    extremiteMax: versTexteEdite(question.libelles_extremites?.max),
  }
}

// Copie d'une question : nouveaux identifiants d'affichage pour elle et pour ses options
function copierQuestion(question: QuestionEditee): QuestionEditee {
  return {
    ...question,
    cle: nouvelleCle(),
    libelle: { ...question.libelle },
    aide: { ...question.aide },
    options: question.options.map((option) => ({ cle: nouvelleCle(), texte: { ...option.texte } })),
    extremiteMin: { ...question.extremiteMin },
    extremiteMax: { ...question.extremiteMax },
  }
}

function brouillonDepuisFiche(fiche: FicheQuestionnaire): BrouillonQuestionnaire {
  const questions = fiche.version !== null ? [...fiche.version.questions].sort((a, b) => a.ordre - b.ordre) : []
  return {
    titre: versTexteEdite(fiche.titre),
    messageAccueil: versTexteEdite(fiche.message_accueil),
    messageRemerciement: versTexteEdite(fiche.message_remerciement),
    langueDefaut: fiche.langue_defaut === 'en' ? 'en' : 'fr',
    questions: questions.map(questionDepuisServeur),
  }
}

// Texte du brouillon sans les identifiants d'affichage, pour comparer deux brouillons
function serialiser(brouillon: BrouillonQuestionnaire): string {
  return JSON.stringify(brouillon, (cle: string, valeur: unknown) => (cle === 'cle' ? undefined : valeur))
}

function etatDepuisBrouillon(brouillon: BrouillonQuestionnaire, version: number | null): Etat {
  return { brouillon, initial: serialiser(brouillon), version }
}

function etatDepuisFiche(fiche: FicheQuestionnaire): Etat {
  return etatDepuisBrouillon(brouillonDepuisFiche(fiche), fiche.version !== null ? fiche.version.numero : null)
}

function etatDeCreation(): Etat {
  return etatDepuisBrouillon(
    {
      titre: texteVide(),
      messageAccueil: texteVide(),
      messageRemerciement: texteVide(),
      langueDefaut: 'fr',
      questions: [questionVide()],
    },
    null,
  )
}

// ------------------------------------------------------------
// Verification et envoi
// ------------------------------------------------------------

function erreurLocale(cle: string, valeurs?: ValeursTexte): ErreurEditeur {
  return valeurs === undefined ? { cle: `${PREFIXE_ERREURS}${cle}` } : { cle: `${PREFIXE_ERREURS}${cle}`, valeurs }
}

function echelleValide(question: QuestionEditee): boolean {
  if (question.echelleMin.trim() === '' || question.echelleMax.trim() === '') {
    return false
  }
  const minimum = Number(question.echelleMin)
  const maximum = Number(question.echelleMax)
  return Number.isInteger(minimum) && Number.isInteger(maximum) && minimum < maximum
}

// Premiere erreur trouvee, ou null si le brouillon peut etre envoye
function valider(brouillon: BrouillonQuestionnaire): ErreurEditeur | null {
  if (brouillon.titre.fr.trim() === '') {
    return erreurLocale('titreVide')
  }
  if (brouillon.questions.length === 0) {
    return erreurLocale('aucuneQuestion')
  }

  for (let i = 0; i < brouillon.questions.length; i += 1) {
    const question = brouillon.questions[i]
    const numero = i + 1

    if (question.libelle.fr.trim() === '') {
      return erreurLocale('questionVide', { numero })
    }
    if (estQuestionAChoix(question.type)) {
      if (question.options.length < NOMBRE_MIN_OPTIONS) {
        return erreurLocale('optionsInsuffisantes', { numero })
      }
      if (question.options.some((option) => option.texte.fr.trim() === '')) {
        return erreurLocale('optionVide', { numero })
      }
    }
    if (question.type === 'ECHELLE' && !echelleValide(question)) {
      return erreurLocale('echelleInvalide', { numero })
    }
  }

  return null
}

function texteEnvoye(texte: TexteEdite): TexteEnvoye {
  const fr = texte.fr.trim()
  const en = texte.en.trim()
  return en === '' ? { fr } : { fr, en }
}

// Un texte facultatif sans francais n'est pas envoye (le serveur exige le francais)
function texteFacultatif(texte: TexteEdite): TexteEnvoye | undefined {
  return texte.fr.trim() === '' ? undefined : texteEnvoye(texte)
}

function questionEnvoyee(question: QuestionEditee): QuestionEnvoyee {
  const envoyee: QuestionEnvoyee = {
    type: question.type,
    libelle: texteEnvoye(question.libelle),
    obligatoire: question.obligatoire,
    theme_id: question.themeId === '' ? null : question.themeId,
  }

  const aide = texteFacultatif(question.aide)
  if (aide !== undefined) {
    envoyee.aide = aide
  }

  if (estQuestionAChoix(question.type)) {
    envoyee.options = question.options.map((option) => texteEnvoye(option.texte))
  }

  if (question.type === 'ECHELLE') {
    envoyee.echelle_min = Number(question.echelleMin)
    envoyee.echelle_max = Number(question.echelleMax)
    // Le serveur veut les deux libelles ou aucun : un seul rempli n'est pas envoye
    const minimum = texteFacultatif(question.extremiteMin)
    const maximum = texteFacultatif(question.extremiteMax)
    if (minimum !== undefined && maximum !== undefined) {
      envoyee.libelles_extremites = { min: minimum, max: maximum }
    }
  }

  return envoyee
}

function construireCorps(brouillon: BrouillonQuestionnaire): CorpsQuestionnaire {
  const corps: CorpsQuestionnaire = {
    titre: texteEnvoye(brouillon.titre),
    langue_defaut: brouillon.langueDefaut,
    questions: brouillon.questions.map(questionEnvoyee),
  }

  const accueil = texteFacultatif(brouillon.messageAccueil)
  if (accueil !== undefined) {
    corps.message_accueil = accueil
  }
  const remerciement = texteFacultatif(brouillon.messageRemerciement)
  if (remerciement !== undefined) {
    corps.message_remerciement = remerciement
  }

  return corps
}

function versErreurService(erreur: unknown): ErreurService {
  if (erreur instanceof ErreurService) {
    return erreur
  }
  return new ErreurService(0, 'ERREUR_INCONNUE', 'Une erreur est survenue.', null)
}

// Le serveur refuse un theme qui n'est pas du secteur avec un 400 dont le detail parle de theme
function estErreurTheme(details: unknown): boolean {
  if (!Array.isArray(details)) {
    return false
  }
  return details.some((detail: unknown) => {
    if (typeof detail !== 'object' || detail === null) {
      return false
    }
    const { champ, message } = detail as { champ?: unknown; message?: unknown }
    return champ === 'questions' && typeof message === 'string' && message.toLowerCase().includes('theme')
  })
}

function erreurDepuisService(erreur: ErreurService): ErreurEditeur {
  if (erreur.statut === 0) {
    return { cle: 'commun.erreurReseau' }
  }
  if (erreur.statut === 403) {
    return erreurLocale('interdit')
  }
  if (erreur.statut === 404) {
    return erreurLocale('introuvable')
  }
  if (erreur.statut === 400 && estErreurTheme(erreur.details)) {
    return erreurLocale('themeInvalide')
  }
  return erreurLocale('generique')
}

// ------------------------------------------------------------
// Le hook
// ------------------------------------------------------------

// Remplace une question de la liste par le resultat de la fonction
function mettreAJourQuestion(
  questions: QuestionEditee[],
  cle: string,
  fonction: (question: QuestionEditee) => QuestionEditee,
): QuestionEditee[] {
  return questions.map((question) => (question.cle === cle ? fonction(question) : question))
}

export function utiliserEditeurQuestionnaire(id: string | null): ResultatEditeurQuestionnaire {
  const { utilisateur, seDeconnecter } = utiliserUtilisateur()

  const acces: AccesEditeur = utilisateur?.role === 'RESPONSABLE' ? 'responsable' : 'aucun'

  // En creation, le brouillon existe tout de suite ; en modification, il arrive avec la fiche.
  const [etat, setEtat] = useState<Etat | null>(() => (id === null ? etatDeCreation() : null))
  const [erreurChargement, setErreurChargement] = useState<ErreurService | null>(null)
  const [themes, setThemes] = useState<ThemeSecteur[] | null>(null)
  const [erreurThemes, setErreurThemes] = useState(false)
  // Augmente a chaque clic sur "Reessayer"
  const [relance, setRelance] = useState(0)

  const [enCours, setEnCours] = useState(false)
  const [erreurEnregistrement, setErreurEnregistrement] = useState<ErreurEditeur | null>(null)
  const [reussite, setReussite] = useState<ReussiteEnregistrement | null>(null)

  // --- Chargement de la fiche (modification seulement) -----------------------------------------

  useEffect(() => {
    if (id === null || acces !== 'responsable') {
      return
    }

    let annule = false

    async function charger(idDemande: string): Promise<void> {
      try {
        const fiche = await lireQuestionnaire(idDemande)
        if (annule) {
          return
        }
        setEtat(etatDepuisFiche(fiche))
        setErreurChargement(null)
      } catch (e) {
        if (annule) {
          return
        }
        const erreurService = versErreurService(e)
        if (erreurService.statut === 401) {
          // Session expiree : retour a la page de connexion.
          void seDeconnecter()
          return
        }
        setErreurChargement(erreurService)
      }
    }

    void charger(id)

    return () => {
      annule = true
    }
  }, [id, acces, relance, seDeconnecter])

  // --- Chargement des themes du secteur --------------------------------------------------------

  useEffect(() => {
    if (acces !== 'responsable') {
      return
    }

    let annule = false

    async function charger(): Promise<void> {
      try {
        const resultat = await listerThemes()
        if (annule) {
          return
        }
        setThemes(resultat)
        setErreurThemes(false)
      } catch (e) {
        if (annule) {
          return
        }
        if (versErreurService(e).statut === 401) {
          void seDeconnecter()
          return
        }
        // Sans les themes, l'editeur marche quand meme : seul le choix du theme est indisponible.
        setErreurThemes(true)
      }
    }

    void charger()

    return () => {
      annule = true
    }
  }, [acces, relance, seDeconnecter])

  const recharger = useCallback(() => {
    setErreurChargement(null)
    setErreurThemes(false)
    setRelance((valeur) => valeur + 1)
  }, [])

  // --- Modifications du brouillon --------------------------------------------------------------

  // Applique une modification au brouillon. Une saisie efface le dernier message d'enregistrement.
  function modifier(fonction: (brouillon: BrouillonQuestionnaire) => BrouillonQuestionnaire): void {
    setEtat((actuel) => (actuel === null ? actuel : { ...actuel, brouillon: fonction(actuel.brouillon) }))
    setErreurEnregistrement(null)
    setReussite(null)
  }

  const actions: ActionsEditeur = {
    modifierGeneral: (champ, langue, valeur) =>
      modifier((brouillon) => ({ ...brouillon, [champ]: { ...brouillon[champ], [langue]: valeur } })),

    changerLangueDefaut: (langue) => modifier((brouillon) => ({ ...brouillon, langueDefaut: langue })),

    ajouterQuestion: () =>
      modifier((brouillon) =>
        brouillon.questions.length >= NOMBRE_MAX_QUESTIONS
          ? brouillon
          : { ...brouillon, questions: [...brouillon.questions, questionVide()] },
      ),

    supprimerQuestion: (cle) =>
      modifier((brouillon) => ({
        ...brouillon,
        questions: brouillon.questions.filter((question) => question.cle !== cle),
      })),

    dupliquerQuestion: (cle) =>
      modifier((brouillon) => {
        const position = brouillon.questions.findIndex((question) => question.cle === cle)
        if (position === -1 || brouillon.questions.length >= NOMBRE_MAX_QUESTIONS) {
          return brouillon
        }
        const questions = [...brouillon.questions]
        questions.splice(position + 1, 0, copierQuestion(brouillon.questions[position]))
        return { ...brouillon, questions }
      }),

    deplacerQuestion: (cle, sens) =>
      modifier((brouillon) => {
        const position = brouillon.questions.findIndex((question) => question.cle === cle)
        const cible = position + sens
        if (position === -1 || cible < 0 || cible >= brouillon.questions.length) {
          return brouillon
        }
        const questions = [...brouillon.questions]
        const [deplacee] = questions.splice(position, 1)
        questions.splice(cible, 0, deplacee)
        return { ...brouillon, questions }
      }),

    changerType: (cle, type) =>
      modifier((brouillon) => ({
        ...brouillon,
        questions: mettreAJourQuestion(brouillon.questions, cle, (question) =>
          question.type === type
            ? question
            : {
                ...question,
                type,
                options: estQuestionAChoix(type) ? completerOptions(question.options) : question.options,
              },
        ),
      })),

    modifierTexteQuestion: (cle, champ, langue, valeur) =>
      modifier((brouillon) => ({
        ...brouillon,
        questions: mettreAJourQuestion(brouillon.questions, cle, (question) => ({
          ...question,
          [champ]: { ...question[champ], [langue]: valeur },
        })),
      })),

    modifierQuestion: (cle, changements) =>
      modifier((brouillon) => ({
        ...brouillon,
        questions: mettreAJourQuestion(brouillon.questions, cle, (question) => ({ ...question, ...changements })),
      })),

    ajouterOption: (cleQuestion) =>
      modifier((brouillon) => ({
        ...brouillon,
        questions: mettreAJourQuestion(brouillon.questions, cleQuestion, (question) =>
          question.options.length >= NOMBRE_MAX_OPTIONS
            ? question
            : { ...question, options: [...question.options, optionVide()] },
        ),
      })),

    supprimerOption: (cleQuestion, cleOption) =>
      modifier((brouillon) => ({
        ...brouillon,
        questions: mettreAJourQuestion(brouillon.questions, cleQuestion, (question) =>
          question.options.length <= NOMBRE_MIN_OPTIONS
            ? question
            : { ...question, options: question.options.filter((option) => option.cle !== cleOption) },
        ),
      })),

    modifierOption: (cleQuestion, cleOption, langue, valeur) =>
      modifier((brouillon) => ({
        ...brouillon,
        questions: mettreAJourQuestion(brouillon.questions, cleQuestion, (question) => ({
          ...question,
          options: question.options.map((option) =>
            option.cle === cleOption ? { ...option, texte: { ...option.texte, [langue]: valeur } } : option,
          ),
        })),
      })),
  }

  // --- Enregistrement --------------------------------------------------------------------------

  const enregistrer = useCallback(async (): Promise<string | null> => {
    if (etat === null || acces !== 'responsable' || enCours) {
      return null
    }

    setReussite(null)
    const invalide = valider(etat.brouillon)
    if (invalide !== null) {
      setErreurEnregistrement(invalide)
      return null
    }

    setErreurEnregistrement(null)
    setEnCours(true)
    try {
      const corps = construireCorps(etat.brouillon)

      if (id === null) {
        const fiche = await creerQuestionnaire(corps)
        setEtat(etatDepuisFiche(fiche))
        setReussite({ type: 'cree', numero: fiche.version !== null ? fiche.version.numero : null })
        return fiche.id
      }

      const reponse = await modifierQuestionnaire(id, corps)
      setEtat(etatDepuisFiche(reponse.questionnaire))
      setReussite({
        type: reponse.nouvelle_version ? 'nouvelleVersion' : 'modifie',
        numero: reponse.questionnaire.version !== null ? reponse.questionnaire.version.numero : null,
      })
      return reponse.questionnaire.id
    } catch (e) {
      const erreurService = versErreurService(e)
      if (erreurService.statut === 401) {
        void seDeconnecter()
        return null
      }
      setErreurEnregistrement(erreurDepuisService(erreurService))
      return null
    } finally {
      setEnCours(false)
    }
  }, [etat, acces, enCours, id, seDeconnecter])

  const nonEnregistre = useMemo(
    () => etat !== null && serialiser(etat.brouillon) !== etat.initial,
    [etat],
  )

  return {
    acces,
    mode: id === null ? 'creation' : 'modification',
    chargement: acces === 'responsable' && etat === null && erreurChargement === null,
    erreurChargement,
    recharger,
    brouillon: etat !== null ? etat.brouillon : null,
    version: etat !== null ? etat.version : null,
    nonEnregistre,
    themes,
    erreurThemes,
    enregistrement: { enCours, erreur: erreurEnregistrement, reussite, enregistrer },
    actions,
  }
}