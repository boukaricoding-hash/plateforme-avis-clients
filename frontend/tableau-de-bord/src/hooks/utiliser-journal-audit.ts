import { useCallback, useEffect, useState } from 'react'
import { listerOrganisations } from '../services/admin'
import { ErreurService } from '../services/api'
import { lireJournal } from '../services/suivi-dts'
import type {
  ActionJournal,
  EntreeJournal,
  PaginationJournal,
  ReponseJournal,
} from '../types/suivi-dts'
import { utiliserUtilisateur } from './utiliser-utilisateur'

// Toutes les donnees de l'ecran du journal d'audit (back-office DTS, jour 24), au meme endroit :
// - les lignes du journal (filtres utilisateur, action, organisation, dates ; pagination) ;
// - les organisations, pour le choix du filtre "organisation".
// Seul l'administrateur DTS a acces a cet ecran : le serveur refuse les autres roles (403).
// Le hook ne fait aucun appel a l'API pour les autres roles ; la page doit les renvoyer
// ailleurs (acces = 'aucun').
// Une session expiree (401) renvoie a la page de connexion.
// Le journal se lit seulement : aucune action n'existe ici.

export type AccesJournalAudit = 'administrateur' | 'aucun'

// Ce que l'administrateur a choisi pour la liste. Une chaine vide veut dire "pas de filtre".
export type FiltresListeJournal = {
  // Morceau de l'adresse e-mail de l'auteur.
  utilisateur: string
  // null = toutes les actions.
  action: ActionJournal | null
  // Identifiant d'une organisation ; chaine vide = toutes.
  organisation: string
  // Jours complets au format AAAA-MM-JJ, bornes comprises.
  du: string
  au: string
  page: number
}

// Une organisation proposee dans le filtre.
export type OrganisationChoixJournal = {
  id: string
  nom: string
}

export type ResultatJournalAudit = {
  acces: AccesJournalAudit
  filtres: FiltresListeJournal
  // Change un ou plusieurs filtres : la liste revient a la page 1.
  appliquerFiltres: (changement: Partial<Omit<FiltresListeJournal, 'page'>>) => void
  // Efface tous les filtres : la liste revient a la page 1.
  reinitialiserFiltres: () => void
  allerPage: (page: number) => void
  // Vrai si la date de debut est apres la date de fin : le serveur refuserait la demande,
  // donc le hook ne l'envoie pas. La page affiche un message et garde la liste cachee.
  periodeInvalide: boolean
  // Lignes de la page ; null tant qu'elles ne sont pas chargees.
  entrees: EntreeJournal[] | null
  pagination: PaginationJournal | null
  // Vrai tant que la liste attend la reponse du serveur (premier chargement ou nouveau filtre).
  chargement: boolean
  // Erreur du chargement de la liste (null = tout va bien).
  erreur: ErreurService | null
  // Organisations pour le filtre, par ordre alphabetique ; null tant qu'elles ne sont pas chargees.
  // Seules les 100 premieres sont proposees (maximum du serveur).
  // Un echec ici ne bloque pas le journal : seul le filtre "organisation" est indisponible.
  organisations: OrganisationChoixJournal[] | null
  erreurOrganisations: ErreurService | null
  // Relance les chargements (bouton "Reessayer").
  recharger: () => void
}

// Nombre de lignes par page (le serveur accepte de 1 a 100).
const ENTREES_PAR_PAGE = 20

// Nombre maximum d'organisations demandees pour le filtre (maximum du serveur).
const ORGANISATIONS_MAX = 100

const FILTRES_DE_DEPART: FiltresListeJournal = {
  utilisateur: '',
  action: null,
  organisation: '',
  du: '',
  au: '',
  page: 1,
}

function versErreurService(erreur: unknown): ErreurService {
  if (erreur instanceof ErreurService) {
    return erreur
  }
  return new ErreurService(0, 'ERREUR_INCONNUE', 'Une erreur est survenue.', null)
}

// Les dates AAAA-MM-JJ se comparent comme du texte.
function estPeriodeInvalide(filtres: FiltresListeJournal): boolean {
  return filtres.du !== '' && filtres.au !== '' && filtres.du > filtres.au
}

// Identifie une demande de liste : change quand les filtres ou le compteur de relance changent.
function construireCle(filtres: FiltresListeJournal, relance: number): string {
  return [
    filtres.utilisateur,
    filtres.action ?? '',
    filtres.organisation,
    filtres.du,
    filtres.au,
    filtres.page,
    relance,
  ].join('|')
}

export function utiliserJournalAudit(): ResultatJournalAudit {
  const { utilisateur, seDeconnecter } = utiliserUtilisateur()

  const acces: AccesJournalAudit = utilisateur?.role === 'ADMINISTRATEUR' ? 'administrateur' : 'aucun'

  const [filtres, setFiltres] = useState<FiltresListeJournal>(FILTRES_DE_DEPART)
  // La reponse garde la demande a laquelle elle repond : tant qu'elles different, on charge.
  const [reponse, setReponse] = useState<{
    cle: string
    donnees: ReponseJournal
  } | null>(null)
  const [erreur, setErreur] = useState<ErreurService | null>(null)
  const [organisations, setOrganisations] = useState<OrganisationChoixJournal[] | null>(null)
  const [erreurOrganisations, setErreurOrganisations] = useState<ErreurService | null>(null)
  // Augmente a chaque clic sur "Reessayer" pour recharger.
  const [relance, setRelance] = useState(0)

  const periodeInvalide = estPeriodeInvalide(filtres)

  const recharger = useCallback(() => {
    setErreur(null)
    setErreurOrganisations(null)
    setRelance((valeur) => valeur + 1)
  }, [])

  const appliquerFiltres = useCallback(
    (changement: Partial<Omit<FiltresListeJournal, 'page'>>) => {
      setErreur(null)
      setFiltres((avant) => ({ ...avant, ...changement, page: 1 }))
    },
    [],
  )

  const reinitialiserFiltres = useCallback(() => {
    setErreur(null)
    setFiltres(FILTRES_DE_DEPART)
  }, [])

  const allerPage = useCallback((page: number) => {
    setErreur(null)
    setFiltres((avant) => ({ ...avant, page }))
  }, [])

  // --- Chargement du journal ---------------------------------------------------------------------

  useEffect(() => {
    // Pas d'appel pour un autre role, ni pour une periode que le serveur refuserait.
    if (acces === 'aucun' || periodeInvalide) {
      return
    }

    let annule = false
    const cle = construireCle(filtres, relance)

    async function charger(): Promise<void> {
      try {
        const donnees = await lireJournal({
          utilisateur: filtres.utilisateur,
          action: filtres.action ?? undefined,
          organisation: filtres.organisation,
          du: filtres.du,
          au: filtres.au,
          page: filtres.page,
          limite: ENTREES_PAR_PAGE,
        })
        if (annule) {
          return
        }
        setReponse({ cle, donnees })
        setErreur(null)
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
        setErreur(erreurService)
      }
    }

    void charger()

    return () => {
      annule = true
    }
  }, [acces, periodeInvalide, filtres, relance, seDeconnecter])

  // --- Chargement des organisations (pour le filtre) ---------------------------------------------

  useEffect(() => {
    if (acces === 'aucun') {
      return
    }

    let annule = false

    async function charger(): Promise<void> {
      try {
        const resultat = await listerOrganisations({ limite: ORGANISATIONS_MAX })
        if (annule) {
          return
        }
        setOrganisations(
          resultat.organisations
            .map((o) => ({ id: o.id, nom: o.nom }))
            .sort((a, b) => a.nom.localeCompare(b.nom, 'fr')),
        )
        setErreurOrganisations(null)
      } catch (e) {
        if (annule) {
          return
        }
        const erreurService = versErreurService(e)
        if (erreurService.statut === 401) {
          void seDeconnecter()
          return
        }
        setErreurOrganisations(erreurService)
      }
    }

    void charger()

    return () => {
      annule = true
    }
  }, [acces, relance, seDeconnecter])

  return {
    acces,
    filtres,
    appliquerFiltres,
    reinitialiserFiltres,
    allerPage,
    periodeInvalide,
    entrees: reponse?.donnees.entrees ?? null,
    pagination: reponse?.donnees.pagination ?? null,
    chargement:
      acces !== 'aucun' &&
      !periodeInvalide &&
      erreur === null &&
      (reponse === null || reponse.cle !== construireCle(filtres, relance)),
    erreur,
    organisations,
    erreurOrganisations,
    recharger,
  }
}
