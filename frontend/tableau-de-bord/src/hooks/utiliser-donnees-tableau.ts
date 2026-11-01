import { useCallback, useEffect, useState } from 'react'
import { ErreurService } from '../services/api'
import {
  chargerDonneesTableau,
  lirePointsContact,
  lireQuestionnaires,
  lireSites,
} from '../services/tableau-de-bord'
import type {
  DonneesTableau,
  FiltresApi,
  FiltresTableau,
  PointContactFiltre,
  QuestionnaireFiltre,
  SiteFiltre,
} from '../types/tableau-de-bord'
import { calculerPeriode, filtresParDefaut, validerPeriode, versFiltresApi } from '../utilitaires/periodes'
import type { ErreurPeriode } from '../utilitaires/periodes'
import { utiliserUtilisateur } from './utiliser-utilisateur'

// Toutes les donnees de l'ecran E7 (jour 14), au meme endroit :
// - les filtres (un seul etat) ; a chaque changement, les six blocs se rechargent ensemble ;
// - l'actualisation toutes les 10 secondes, sans faire clignoter l'ecran
//   (les anciennes donnees restent affichees pendant le rechargement), en pause si l'onglet est cache ;
// - les listes de la barre de filtres (sites, points de contact, questionnaires) ;
// - les erreurs : avec des donnees deja affichees, elles restent a l'ecran avec un avertissement.

const INTERVALLE_ACTUALISATION_MS = 10000

export type ResultatTableau = {
  // Filtres
  filtres: FiltresTableau
  changerFiltres: (modifications: Partial<FiltresTableau>) => void
  reinitialiserFiltres: () => void
  // Erreur de la periode personnalisee (null = periode valide) : aucun rechargement tant qu'elle dure.
  erreurPeriode: ErreurPeriode | null

  // Donnees
  donnees: DonneesTableau | null
  // Les filtres (noms de l'API) qui ont produit les donnees affichees : a utiliser pour les liens des clics.
  filtresAffiches: FiltresApi | null
  // Vrai tant qu'on attend la toute premiere reponse.
  chargementInitial: boolean
  // Vrai pendant un rechargement demande (nouveau filtre, bouton Actualiser), pas pendant les cycles de 10 s.
  actualisationEnCours: boolean
  erreur: ErreurService | null
  derniereMiseAJour: Date | null
  actualiser: () => void

  // Listes de la barre de filtres
  sites: SiteFiltre[]
  pointsContact: PointContactFiltre[]
  questionnaires: QuestionnaireFiltre[]
  erreurListes: boolean
}

function versErreurService(erreur: unknown): ErreurService {
  if (erreur instanceof ErreurService) {
    return erreur
  }
  return new ErreurService(0, 'ERREUR_INCONNUE', 'Une erreur est survenue.', null)
}

export function utiliserDonneesTableau(): ResultatTableau {
  const { seDeconnecter } = utiliserUtilisateur()

  const [filtres, setFiltres] = useState<FiltresTableau>(filtresParDefaut)
  const [donnees, setDonnees] = useState<DonneesTableau | null>(null)
  const [filtresAffiches, setFiltresAffiches] = useState<FiltresApi | null>(null)
  const [enCours, setEnCours] = useState(true)
  const [erreur, setErreur] = useState<ErreurService | null>(null)
  const [derniereMiseAJour, setDerniereMiseAJour] = useState<Date | null>(null)
  // Augmente a chaque clic sur "Actualiser" ou "Reessayer" pour relancer le chargement.
  const [relance, setRelance] = useState(0)

  const [sites, setSites] = useState<SiteFiltre[]>([])
  const [pointsContact, setPointsContact] = useState<PointContactFiltre[]>([])
  const [questionnaires, setQuestionnaires] = useState<QuestionnaireFiltre[]>([])
  const [erreurListes, setErreurListes] = useState(false)

  const erreurPeriode = validerPeriode(filtres)

  // --- Filtres ---------------------------------------------------------------

  const changerFiltres = useCallback((modifications: Partial<FiltresTableau>) => {
    setFiltres((avant) => {
      const apres: FiltresTableau = { ...avant, ...modifications }

      // Changer de site : le point de contact choisi n'est plus forcement de ce site.
      if (
        modifications.site !== undefined &&
        modifications.site !== avant.site &&
        modifications.point === undefined
      ) {
        apres.point = ''
      }

      // Passer en periode personnalisee : on part de la periode qui etait affichee.
      if (modifications.periode === 'personnalisee' && apres.debut === '' && apres.fin === '') {
        const courante = calculerPeriode(avant)
        if (courante !== null) {
          apres.debut = courante.from
          apres.fin = courante.to
        }
      }

      return apres
    })
  }, [])

  const reinitialiserFiltres = useCallback(() => {
    setFiltres(filtresParDefaut())
  }, [])

  const actualiser = useCallback(() => {
    setRelance((valeur) => valeur + 1)
  }, [])

  // --- Chargement des donnees ------------------------------------------------

  useEffect(() => {
    // Periode personnalisee invalide : on garde l'ecran tel quel, la barre affiche l'erreur.
    if (validerPeriode(filtres) !== null) {
      return
    }

    let annule = false
    let enVol = false

    // silencieux = true pour les cycles automatiques : aucun indicateur, aucun clignotement.
    async function charger(silencieux: boolean): Promise<void> {
      // Les dates de "aujourd'hui", "7 jours"... sont recalculees a chaque cycle.
      const filtresApi = versFiltresApi(filtres)
      if (filtresApi === null || enVol) {
        return
      }
      enVol = true
      if (!silencieux) {
        setEnCours(true)
      }

      try {
        const resultat = await chargerDonneesTableau(filtresApi)
        if (annule) {
          return
        }
        setDonnees(resultat)
        setFiltresAffiches(filtresApi)
        setErreur(null)
        setDerniereMiseAJour(new Date())
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
        // Les donnees deja affichees restent a l'ecran.
        setErreur(erreurService)
      } finally {
        enVol = false
        if (!annule) {
          setEnCours(false)
        }
      }
    }

    void charger(false)

    // Actualisation automatique, sauf si l'onglet du navigateur est cache.
    const minuteur = window.setInterval(() => {
      if (!document.hidden) {
        void charger(true)
      }
    }, INTERVALLE_ACTUALISATION_MS)

    // Retour sur l'onglet : on remet les chiffres a jour tout de suite.
    function auChangementDeVisibilite(): void {
      if (!document.hidden) {
        void charger(true)
      }
    }
    document.addEventListener('visibilitychange', auChangementDeVisibilite)

    return () => {
      annule = true
      window.clearInterval(minuteur)
      document.removeEventListener('visibilitychange', auChangementDeVisibilite)
    }
  }, [filtres, relance, seDeconnecter])

  // --- Listes de la barre de filtres -----------------------------------------

  // Sites et questionnaires : une seule fois.
  useEffect(() => {
    let annule = false
    Promise.all([lireSites(), lireQuestionnaires()])
      .then(([reponseSites, reponseQuestionnaires]) => {
        if (annule) {
          return
        }
        setSites(reponseSites.sites)
        setQuestionnaires(reponseQuestionnaires.questionnaires)
      })
      .catch(() => {
        if (!annule) {
          setErreurListes(true)
        }
      })
    return () => {
      annule = true
    }
  }, [])

  // Points de contact : de tout l'etablissement, ou du site choisi.
  useEffect(() => {
    let annule = false
    lirePointsContact(filtres.site)
      .then((reponse) => {
        if (!annule) {
          setPointsContact(reponse.points_contact)
        }
      })
      .catch(() => {
        if (!annule) {
          setErreurListes(true)
        }
      })
    return () => {
      annule = true
    }
  }, [filtres.site])

  return {
    filtres,
    changerFiltres,
    reinitialiserFiltres,
    erreurPeriode,
    donnees,
    filtresAffiches,
    chargementInitial: donnees === null && erreur === null,
    actualisationEnCours: enCours && erreurPeriode === null,
    erreur,
    derniereMiseAJour,
    actualiser,
    sites,
    pointsContact,
    questionnaires,
    erreurListes,
  }
}