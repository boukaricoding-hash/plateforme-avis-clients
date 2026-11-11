import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ErreurService } from '../services/api'
import { analyserAvis, genererExport } from '../services/exports'
import { listerPointsContact } from '../services/points-contact'
import { listerQuestionnaires } from '../services/questionnaires'
import { listerSites } from '../services/sites'
import type {
  CodePointAnalyse,
  EtapeExport,
  EtatOperation,
  FiltresEcranExport,
  FormatExport,
  HumeurRobot,
  ReponseAnalyse,
} from '../types/exports'
import type { ResumeQuestionnaire } from '../types/questionnaires'
import type { PointContact, Site } from '../types/sites-points'
import {
  comprendreRecherche,
  filtresEcranParDefaut,
  versFiltresExport,
  type ContexteRecherche,
  type MotCompris,
  type ProblemeRecherche,
  type ResultatRecherche,
} from '../utilitaires/comprendre-recherche'
import { validerPeriode, type ErreurPeriode } from '../utilitaires/periodes'
import { utiliserLangue } from './utiliser-langue'
import { utiliserUtilisateur } from './utiliser-utilisateur'

// Toute la logique de l'ecran E16 (exports et rapports, jour 21), au meme endroit :
// - ce que l'utilisateur tape dans la barre, et ce que le robot en comprend (comprendre-recherche.ts) ;
// - le format et les filtres choisis, a la main ou par le texte ;
// - l'analyse des avis filtres (POST /exports/analyse), relancee toute seule quand les filtres changent ;
// - la creation et le telechargement du fichier (POST /exports) ;
// - l'humeur du robot et l'indication en cours (1 Format, 2 Periode et filtres, 3 Generer, 4 Telecharger).
// Le Responsable et le Gestionnaire utilisent l'ecran ; le Gestionnaire n'exporte que son perimetre
// (le serveur le decide). L'administrateur DTS n'a pas d'organisation : le hook ne fait alors aucun
// appel et la page doit le renvoyer ailleurs (acces = 'aucun').
// Une session expiree (401) renvoie a la page de connexion.
//
// Texte et choix a la main : chaque frappe est comparee a la precedente. Un mot nouveau ou change
// ecrit son effet dans les choix ; un mot efface retire son effet, sauf si l'utilisateur a change
// ce choix entre-temps a la main. Le dernier geste (frappe ou clic) gagne toujours.

// Attente apres le dernier changement avant d'analyser : pas un appel par touche tapee.
const DELAI_ANALYSE_MS = 500

// Le robot "ecoute" tant que l'utilisateur tape, puis revient au repos apres ce delai.
const DELAI_ECOUTE_MS = 1500

// Points faibles assez serieux pour que le robot soit inquiet quand l'analyse est terminee.
const CODES_INQUIETANTS: readonly CodePointAnalyse[] = [
  'note_basse',
  'nps_negatif',
  'alertes_qui_trainent',
  'baisse_note',
]

export type AccesExports = 'autorise' | 'aucun'

export type ResultatExport = {
  acces: AccesExports

  // --- Barre de recherche ---------------------------------------------------------------------
  texte: string
  changerTexte: (texte: string) => void
  // Mots compris dans le texte (pastilles) et ce que le robot n'a pas pu faire (il est inquiet).
  mots: MotCompris[]
  problemes: ProblemeRecherche[]

  // --- Choix ----------------------------------------------------------------------------------
  // null : pas encore de format (indication 1).
  format: FormatExport | null
  choisirFormat: (format: FormatExport) => void
  filtres: FiltresEcranExport
  // Change un ou plusieurs filtres a la main. Changer de site vide le point de contact choisi.
  changerFiltres: (changements: Partial<FiltresEcranExport>) => void
  // Erreur de la periode personnalisee (dates manquantes, inversees ou trop longues), sinon null.
  // Le nom est celui des textes tableau.filtres.datesRequises, datesInversees et periodeTropLongue.
  erreurPeriode: ErreurPeriode | null
  // Vrai : le rapport pdf va prendre les 30 derniers jours, car aucune date n'est choisie.
  rapportSurTrenteJours: boolean

  // --- Listes des menus (un echec ici ne bloque pas l'ecran : seuls les noms ne sont pas compris) -
  sites: Site[]
  points: PointContact[]
  questionnaires: ResumeQuestionnaire[]
  erreurListes: boolean

  // --- Analyse du robot -------------------------------------------------------------------------
  // L'analyse des filtres actuels ; null tant qu'elle n'est pas arrivee (jamais celle d'autres filtres).
  analyse: ReponseAnalyse | null
  etatAnalyse: EtatOperation
  erreurAnalyse: ErreurService | null

  // --- Fichier ----------------------------------------------------------------------------------
  // 'termine' : le fichier est enregistre sur l'appareil. Il repasse a 'repos' des qu'un choix change.
  etatGeneration: EtatOperation
  // Erreur 422 EXPORT_TROP_VOLUMINEUX : il faut reduire la periode (csv et excel).
  erreurGeneration: ErreurService | null
  // Nom du fichier enregistre quand etatGeneration vaut 'termine'.
  nomFichier: string | null
  // Format choisi, periode valide et aucune creation en cours.
  peutGenerer: boolean
  generer: () => Promise<void>

  // --- Robot et indications ---------------------------------------------------------------------
  humeur: HumeurRobot
  etape: EtapeExport
}

function versErreurService(erreur: unknown): ErreurService {
  if (erreur instanceof ErreurService) {
    return erreur
  }
  return new ErreurService(0, 'ERREUR_INCONNUE', 'Une erreur est survenue.', null)
}

// ------------------------------------------------------------
// Texte tape et choix a la main
// ------------------------------------------------------------

function copierFiltre<K extends keyof FiltresEcranExport>(
  cible: FiltresEcranExport,
  source: Partial<FiltresEcranExport>,
  cle: K,
): void {
  const valeur = source[cle]
  if (valeur !== undefined) {
    cible[cle] = valeur
  }
}

// Compare ce que le texte disait avant et apres la frappe, et ne touche qu'a ce qui a change.
function fusionnerFiltres(
  courants: FiltresEcranExport,
  avant: ResultatRecherche,
  apres: ResultatRecherche,
): FiltresEcranExport {
  const defauts = filtresEcranParDefaut()
  const suivants = { ...courants }
  const cles = Object.keys(defauts) as (keyof FiltresEcranExport)[]
  for (const cle of cles) {
    const diteAvant = cle in avant.filtres
    const diteApres = cle in apres.filtres
    if (diteApres) {
      // Mot nouveau ou change : son effet s'ecrit dans les choix.
      if (!diteAvant || avant.filtres[cle] !== apres.filtres[cle]) {
        copierFiltre(suivants, apres.filtres, cle)
      }
    } else if (diteAvant && courants[cle] === avant.filtres[cle]) {
      // Mot efface : on retire son effet, sauf si l'utilisateur a change ce choix a la main depuis.
      copierFiltre(suivants, defauts, cle)
    }
  }
  return suivants
}

function fusionnerFormat(
  courant: FormatExport | null,
  avant: ResultatRecherche,
  apres: ResultatRecherche,
): FormatExport | null {
  if (apres.format !== null) {
    return apres.format !== avant.format ? apres.format : courant
  }
  return avant.format !== null && courant === avant.format ? null : courant
}

// ------------------------------------------------------------
// Etat des operations
// ------------------------------------------------------------

type EtatAnalyseStocke = {
  // Les filtres et la langue pour lesquels l'appel a ete fait : on ne montre jamais l'analyse d'autres filtres.
  cle: string
  analyse: ReponseAnalyse | null
  erreur: ErreurService | null
}

type EtatGenerationStocke = {
  etat: EtatOperation
  cle: string | null
  nom: string | null
  erreur: ErreurService | null
}

const GENERATION_AU_REPOS: EtatGenerationStocke = {
  etat: 'repos',
  cle: null,
  nom: null,
  erreur: null,
}

// ------------------------------------------------------------
// Le hook
// ------------------------------------------------------------

export function utiliserExport(): ResultatExport {
  const { utilisateur, seDeconnecter } = utiliserUtilisateur()
  const { langue } = utiliserLangue()

  const role = utilisateur?.role ?? null
  const acces: AccesExports = role === 'RESPONSABLE' || role === 'GESTIONNAIRE' ? 'autorise' : 'aucun'

  const [texte, setTexte] = useState('')
  const [format, setFormat] = useState<FormatExport | null>(null)
  const [filtres, setFiltres] = useState<FiltresEcranExport>(filtresEcranParDefaut)
  const [enSaisie, setEnSaisie] = useState(false)
  const minuterieSaisie = useRef<number | undefined>(undefined)

  const [sites, setSites] = useState<Site[]>([])
  const [points, setPoints] = useState<PointContact[]>([])
  const [questionnaires, setQuestionnaires] = useState<ResumeQuestionnaire[]>([])
  const [erreurListes, setErreurListes] = useState(false)

  const [resultatAnalyse, setResultatAnalyse] = useState<EtatAnalyseStocke | null>(null)
  const [generation, setGeneration] = useState<EtatGenerationStocke>(GENERATION_AU_REPOS)

  // --- Chargement des listes (une seule fois) ---------------------------------------------------

  useEffect(() => {
    if (acces !== 'autorise') {
      return
    }

    let annule = false

    // Chaque liste est independante : si l'une echoue, les autres servent quand meme.
    void Promise.allSettled([listerSites(), listerPointsContact(), listerQuestionnaires()]).then(
      ([resultatSites, resultatPoints, resultatQuestionnaires]) => {
        if (annule) {
          return
        }
        const resultats = [resultatSites, resultatPoints, resultatQuestionnaires]
        const sessionExpiree = resultats.some(
          (resultat) =>
            resultat.status === 'rejected' &&
            resultat.reason instanceof ErreurService &&
            resultat.reason.statut === 401,
        )
        if (sessionExpiree) {
          void seDeconnecter()
          return
        }
        if (resultatSites.status === 'fulfilled') {
          setSites(resultatSites.value)
        }
        if (resultatPoints.status === 'fulfilled') {
          setPoints(resultatPoints.value)
        }
        if (resultatQuestionnaires.status === 'fulfilled') {
          setQuestionnaires(resultatQuestionnaires.value)
        }
        setErreurListes(resultats.some((resultat) => resultat.status === 'rejected'))
      },
    )

    return () => {
      annule = true
    }
  }, [acces, seDeconnecter])

  // --- Ce que le robot comprend du texte --------------------------------------------------------

  const contexte = useMemo<ContexteRecherche>(
    () => ({
      sites: sites.map((site) => ({ id: site.id, noms: [site.nom] })),
      points: points.map((point) => ({ id: point.id, siteId: point.site_id, noms: [point.nom] })),
      questionnaires: questionnaires.map((questionnaire) => ({
        id: questionnaire.id,
        noms: questionnaire.titre.en
          ? [questionnaire.titre.fr, questionnaire.titre.en]
          : [questionnaire.titre.fr],
      })),
    }),
    [sites, points, questionnaires],
  )

  const comprise = useMemo(() => comprendreRecherche(texte, contexte), [texte, contexte])

  const changerTexte = useCallback(
    (nouveauTexte: string) => {
      const apres = comprendreRecherche(nouveauTexte, contexte)
      setTexte(nouveauTexte)
      setFiltres((courants) => fusionnerFiltres(courants, comprise, apres))
      setFormat((courant) => fusionnerFormat(courant, comprise, apres))

      // Le robot ecoute tant qu'on tape.
      setEnSaisie(true)
      window.clearTimeout(minuterieSaisie.current)
      minuterieSaisie.current = window.setTimeout(() => setEnSaisie(false), DELAI_ECOUTE_MS)
    },
    [comprise, contexte],
  )

  useEffect(() => {
    return () => {
      window.clearTimeout(minuterieSaisie.current)
    }
  }, [])

  // --- Choix a la main --------------------------------------------------------------------------

  const choisirFormat = useCallback((nouveauFormat: FormatExport) => {
    setFormat(nouveauFormat)
  }, [])

  const changerFiltres = useCallback((changements: Partial<FiltresEcranExport>) => {
    setFiltres((courants) => {
      const suivants = { ...courants, ...changements }
      // Un point de contact appartient a un site : changer de site vide le point (sauf s'il est donne).
      if (
        changements.site !== undefined &&
        changements.site !== courants.site &&
        changements.point === undefined
      ) {
        suivants.point = ''
      }
      return suivants
    })
  }, [])

  // --- Filtres de l'API et periode --------------------------------------------------------------

  const filtresApi = useMemo(() => versFiltresExport(filtres), [filtres])

  const erreurPeriode = validerPeriode({
    periode: filtres.periode === 'tout' ? '30jours' : filtres.periode,
    debut: filtres.debut,
    fin: filtres.fin,
    site: '',
    point: '',
    questionnaire: '',
  })

  // --- Analyse (relancee quand les filtres ou la langue changent) -------------------------------

  const cleAnalyse = useMemo(
    () => (filtresApi === null ? null : JSON.stringify({ langue, filtres: filtresApi })),
    [filtresApi, langue],
  )

  useEffect(() => {
    if (acces !== 'autorise' || cleAnalyse === null || filtresApi === null) {
      return
    }

    let annule = false

    const minuterie = window.setTimeout(() => {
      analyserAvis({ langue, filtres: filtresApi })
        .then((analyse) => {
          if (!annule) {
            setResultatAnalyse({ cle: cleAnalyse, analyse, erreur: null })
          }
        })
        .catch((e: unknown) => {
          if (annule) {
            return
          }
          const erreur = versErreurService(e)
          if (erreur.statut === 401) {
            // Session expiree : retour a la page de connexion.
            void seDeconnecter()
            return
          }
          setResultatAnalyse({ cle: cleAnalyse, analyse: null, erreur })
        })
    }, DELAI_ANALYSE_MS)

    return () => {
      annule = true
      window.clearTimeout(minuterie)
    }
  }, [acces, cleAnalyse, filtresApi, langue, seDeconnecter])

  const analyseAJour = resultatAnalyse !== null && resultatAnalyse.cle === cleAnalyse
  const analyse = analyseAJour ? resultatAnalyse.analyse : null
  const erreurAnalyse = analyseAJour ? resultatAnalyse.erreur : null
  const etatAnalyse: EtatOperation =
    acces !== 'autorise' || cleAnalyse === null
      ? 'repos'
      : !analyseAJour
        ? 'en_cours'
        : resultatAnalyse.erreur === null
          ? 'termine'
          : 'erreur'

  // --- Creation et telechargement du fichier ----------------------------------------------------

  const cleGeneration = useMemo(
    () =>
      format === null || filtresApi === null
        ? null
        : JSON.stringify({ format, langue, filtres: filtresApi }),
    [format, filtresApi, langue],
  )

  // Un fichier deja enregistre n'est plus "pret" des que le format, les filtres ou la langue changent.
  const etatGeneration: EtatOperation =
    generation.etat === 'en_cours'
      ? 'en_cours'
      : generation.etat !== 'repos' && generation.cle === cleGeneration
        ? generation.etat
        : 'repos'
  const generationActuelle = etatGeneration === generation.etat ? generation : GENERATION_AU_REPOS

  const peutGenerer = acces === 'autorise' && cleGeneration !== null && etatGeneration !== 'en_cours'

  const generer = useCallback(async (): Promise<void> => {
    if (!peutGenerer || format === null || filtresApi === null || cleGeneration === null) {
      return
    }

    setGeneration({ etat: 'en_cours', cle: cleGeneration, nom: null, erreur: null })
    try {
      const nom = await genererExport({ format, langue, filtres: filtresApi })
      setGeneration({ etat: 'termine', cle: cleGeneration, nom, erreur: null })
    } catch (e) {
      const erreur = versErreurService(e)
      if (erreur.statut === 401) {
        void seDeconnecter()
        return
      }
      setGeneration({ etat: 'erreur', cle: cleGeneration, nom: null, erreur })
    }
  }, [peutGenerer, format, filtresApi, cleGeneration, langue, seDeconnecter])

  // --- Robot et indications ---------------------------------------------------------------------

  const aUnPointInquietant =
    analyse !== null && analyse.points_faibles.some((point) => CODES_INQUIETANTS.includes(point.code))

  // Ordre : un probleme technique ou de saisie, puis l'ecoute (on tape), puis la reflexion
  // (analyse ou creation du fichier), puis la joie (fichier pret), puis l'inquietude face aux
  // chiffres, et enfin le repos.
  let humeur: HumeurRobot = 'repos'
  if (
    comprise.problemes.length > 0 ||
    erreurPeriode !== null ||
    erreurAnalyse !== null ||
    generationActuelle.erreur !== null
  ) {
    humeur = 'inquiet'
  } else if (enSaisie) {
    humeur = 'ecoute'
  } else if (etatAnalyse === 'en_cours' || etatGeneration === 'en_cours') {
    humeur = 'reflechit'
  } else if (etatGeneration === 'termine') {
    humeur = 'content'
  } else if (aUnPointInquietant) {
    humeur = 'inquiet'
  }

  const filtresChanges = JSON.stringify(filtres) !== JSON.stringify(filtresEcranParDefaut())
  const etape: EtapeExport =
    etatGeneration === 'termine'
      ? 4
      : etatGeneration === 'en_cours' || (format !== null && filtresChanges)
        ? 3
        : format !== null
          ? 2
          : 1

  return {
    acces,
    texte,
    changerTexte,
    mots: comprise.mots,
    problemes: comprise.problemes,
    format,
    choisirFormat,
    filtres,
    changerFiltres,
    erreurPeriode,
    rapportSurTrenteJours: format === 'pdf' && filtres.periode === 'tout',
    sites,
    points,
    questionnaires,
    erreurListes,
    analyse,
    etatAnalyse,
    erreurAnalyse,
    etatGeneration,
    erreurGeneration: generationActuelle.erreur,
    nomFichier: generationActuelle.nom,
    peutGenerer,
    generer,
    humeur,
    etape,
  }
}