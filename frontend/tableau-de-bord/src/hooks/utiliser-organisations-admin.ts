import { useCallback, useEffect, useState } from 'react'
import {
  creerOrganisation,
  inviterResponsable,
  listerOrganisations,
  listerSecteurs,
  modifierOrganisation,
  reactiverOrganisation,
  suspendreOrganisation,
} from '../services/admin'
import { ErreurService } from '../services/api'
import type {
  CorpsCreationOrganisation,
  CorpsModificationOrganisation,
  OrganisationAdmin,
  PaginationOrganisations,
  ReponseCreationOrganisation,
  ReponseInvitationResponsable,
  ReponseListeOrganisations,
  SecteurListe,
  StatutOrganisation,
} from '../types/admin'
import type { EtatAction } from './utiliser-sites-points'
import { utiliserUtilisateur } from './utiliser-utilisateur'

// Toutes les donnees de l'ecran E17 (organisations du back-office DTS, jour 23), au meme endroit :
// - la liste des organisations (recherche, filtre de statut, pagination) ;
// - les secteurs actifs, pour choisir celui d'une nouvelle organisation ;
// - les actions (creer, modifier, suspendre, reactiver, inviter le premier responsable)
//   avec leur etat : en cours, succes, erreur.
// Seul l'administrateur DTS a acces a cet ecran : le serveur refuse les autres roles (403).
// Le hook ne fait aucun appel a l'API pour les autres roles ; la page doit les renvoyer
// ailleurs (acces = 'aucun').
// Une session expiree (401) renvoie a la page de connexion.

export type AccesOrganisationsAdmin = 'administrateur' | 'aucun'

// Ce que l'administrateur a choisi pour la liste.
export type FiltresListe = {
  // Recherche dans le nom ; chaine vide = pas de recherche.
  q: string
  // null = tous les statuts.
  statut: StatutOrganisation | null
  page: number
}

export type ActionCreation = EtatAction & {
  // Cree l'organisation (le modele de son secteur est copie en brouillon par le serveur).
  // Renvoie la reponse du serveur, ou null si la creation a echoue.
  creer: (corps: CorpsCreationOrganisation) => Promise<ReponseCreationOrganisation | null>
  // Efface le succes et l'erreur (a l'ouverture ou a la fermeture du formulaire).
  reinitialiser: () => void
}

export type ActionsOrganisations = EtatAction & {
  // Nom, couleur, pays, fuseau ou langue (au moins un). Renvoie true si c'est fait.
  modifier: (id: string, corps: CorpsModificationOrganisation) => Promise<boolean>
  // Bloque la connexion et les QR codes de l'organisation. Renvoie true si c'est fait.
  suspendre: (id: string) => Promise<boolean>
  // Remet l'organisation au statut ACTIF. Renvoie true si c'est fait.
  reactiver: (id: string) => Promise<boolean>
  // Efface le succes et l'erreur (quand on ouvre ou ferme une confirmation).
  reinitialiser: () => void
}

export type ActionInvitationResponsable = EtatAction & {
  // Derniere invitation envoyee avec succes (email_envoye false = e-mail refuse) ; sinon null.
  resultat: ReponseInvitationResponsable | null
  // Invite le premier responsable. On peut renvoyer : la nouvelle invitation remplace l'ancienne.
  // Renvoie true si c'est fait.
  inviter: (organisationId: string, email: string) => Promise<boolean>
  // Efface le resultat et l'erreur (a l'ouverture ou a la fermeture du formulaire).
  reinitialiser: () => void
}

export type ResultatOrganisationsAdmin = {
  acces: AccesOrganisationsAdmin
  filtres: FiltresListe
  // Change la recherche ou le statut : la liste revient a la page 1.
  appliquerFiltres: (changement: Partial<Omit<FiltresListe, 'page'>>) => void
  allerPage: (page: number) => void
  // Organisations de la page ; null tant qu'elles ne sont pas chargees.
  organisations: OrganisationAdmin[] | null
  pagination: PaginationOrganisations | null
  // Vrai tant que la liste attend la reponse du serveur (premier chargement ou nouveau filtre).
  chargement: boolean
  // Erreur du chargement de la liste (null = tout va bien).
  erreur: ErreurService | null
  // Secteurs actifs ; null tant qu'ils ne sont pas charges.
  // Un echec ici ne bloque pas la liste : seule la creation est indisponible.
  secteurs: SecteurListe[] | null
  erreurSecteurs: ErreurService | null
  // Relance les chargements (bouton "Reessayer").
  recharger: () => void
  creation: ActionCreation
  actions: ActionsOrganisations
  invitation: ActionInvitationResponsable
}

// Nombre d'organisations par page (le serveur accepte de 1 a 100).
const ORGANISATIONS_PAR_PAGE = 20

const FILTRES_DE_DEPART: FiltresListe = { q: '', statut: null, page: 1 }

function versErreurService(erreur: unknown): ErreurService {
  if (erreur instanceof ErreurService) {
    return erreur
  }
  return new ErreurService(0, 'ERREUR_INCONNUE', 'Une erreur est survenue.', null)
}

// Tri des secteurs par nom, pour le choix a la creation.
function trierSecteurs(secteurs: SecteurListe[]): SecteurListe[] {
  return [...secteurs].sort((a, b) => a.nom_fr.localeCompare(b.nom_fr, 'fr'))
}

// Identifie une demande de liste : change quand les filtres ou le compteur de relance changent.
function construireCle(filtres: FiltresListe, relance: number): string {
  return `${filtres.q}|${filtres.statut ?? ''}|${filtres.page}|${relance}`
}

// Etat commun d'une action (en cours, succes, erreur) et son execution.
// Une session expiree (401) deconnecte l'utilisateur ; l'action renvoie alors null.
// surErreur est appelee pour les autres erreurs, avant l'affichage (par exemple pour recharger).
function utiliserAction(seDeconnecter: () => Promise<void>) {
  const [enCours, setEnCours] = useState(false)
  const [succes, setSucces] = useState(false)
  const [erreur, setErreur] = useState<ErreurService | null>(null)

  const executer = useCallback(
    async <T>(
      appel: () => Promise<T>,
      surErreur?: (erreur: ErreurService) => void,
    ): Promise<T | null> => {
      setSucces(false)
      setErreur(null)
      setEnCours(true)
      try {
        const resultat = await appel()
        setSucces(true)
        return resultat
      } catch (e) {
        const erreurService = versErreurService(e)
        if (erreurService.statut === 401) {
          void seDeconnecter()
          return null
        }
        surErreur?.(erreurService)
        setErreur(erreurService)
        return null
      } finally {
        setEnCours(false)
      }
    },
    [seDeconnecter],
  )

  const reinitialiserEtat = useCallback(() => {
    setSucces(false)
    setErreur(null)
  }, [])

  return { enCours, succes, erreur, executer, reinitialiserEtat }
}

export function utiliserOrganisationsAdmin(): ResultatOrganisationsAdmin {
  const { utilisateur, seDeconnecter } = utiliserUtilisateur()

  const acces: AccesOrganisationsAdmin =
    utilisateur?.role === 'ADMINISTRATEUR' ? 'administrateur' : 'aucun'

  const [filtres, setFiltres] = useState<FiltresListe>(FILTRES_DE_DEPART)
  // La reponse garde la demande a laquelle elle repond : tant qu'elles different, on charge.
  const [reponse, setReponse] = useState<{
    cle: string
    donnees: ReponseListeOrganisations
  } | null>(null)
  const [erreur, setErreur] = useState<ErreurService | null>(null)
  const [secteurs, setSecteurs] = useState<SecteurListe[] | null>(null)
  const [erreurSecteurs, setErreurSecteurs] = useState<ErreurService | null>(null)
  const [resultatInvitation, setResultatInvitation] =
    useState<ReponseInvitationResponsable | null>(null)
  // Augmente a chaque clic sur "Reessayer", apres une creation ou un conflit pour recharger.
  const [relance, setRelance] = useState(0)

  const actionCreation = utiliserAction(seDeconnecter)
  const actionOrganisation = utiliserAction(seDeconnecter)
  const actionInvitation = utiliserAction(seDeconnecter)

  const recharger = useCallback(() => {
    setErreur(null)
    setErreurSecteurs(null)
    setRelance((valeur) => valeur + 1)
  }, [])

  const appliquerFiltres = useCallback(
    (changement: Partial<Omit<FiltresListe, 'page'>>) => {
      setErreur(null)
      setFiltres((avant) => ({ ...avant, ...changement, page: 1 }))
    },
    [],
  )

  const allerPage = useCallback((page: number) => {
    setErreur(null)
    setFiltres((avant) => ({ ...avant, page }))
  }, [])

  // --- Chargement de la liste ------------------------------------------------------------------

  useEffect(() => {
    if (acces === 'aucun') {
      return
    }

    let annule = false
    const cle = construireCle(filtres, relance)

    async function charger(): Promise<void> {
      try {
        const donnees = await listerOrganisations({
          q: filtres.q,
          statut: filtres.statut ?? undefined,
          page: filtres.page,
          limite: ORGANISATIONS_PAR_PAGE,
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
  }, [acces, filtres, relance, seDeconnecter])

  // --- Chargement des secteurs actifs (pour la creation) ---------------------------------------

  useEffect(() => {
    if (acces === 'aucun') {
      return
    }

    let annule = false

    async function charger(): Promise<void> {
      try {
        const resultat = await listerSecteurs({ actif: true })
        if (annule) {
          return
        }
        setSecteurs(trierSecteurs(resultat))
        setErreurSecteurs(null)
      } catch (e) {
        if (annule) {
          return
        }
        const erreurService = versErreurService(e)
        if (erreurService.statut === 401) {
          void seDeconnecter()
          return
        }
        setErreurSecteurs(erreurService)
      }
    }

    void charger()

    return () => {
      annule = true
    }
  }, [acces, relance, seDeconnecter])

  // --- Creation ----------------------------------------------------------------------------------

  const { executer: executerCreation, reinitialiserEtat: reinitialiserEtatCreation } =
    actionCreation

  const creer = useCallback(
    async (corps: CorpsCreationOrganisation): Promise<ReponseCreationOrganisation | null> => {
      const resultat = await executerCreation(() => creerOrganisation(corps))
      if (resultat === null) {
        return null
      }
      // La nouvelle organisation est la plus recente : on repart d'une liste sans filtre
      // pour qu'elle soit visible tout de suite (et les secteurs comptent une organisation de plus).
      setErreur(null)
      setFiltres(FILTRES_DE_DEPART)
      setRelance((valeur) => valeur + 1)
      return resultat
    },
    [executerCreation],
  )

  // --- Modification, suspension et reactivation --------------------------------------------------

  const { executer: executerOrganisation, reinitialiserEtat: reinitialiserEtatOrganisation } =
    actionOrganisation

  const remplacerOrganisation = useCallback((modifiee: OrganisationAdmin) => {
    setReponse((avant) =>
      avant === null
        ? avant
        : {
            ...avant,
            donnees: {
              ...avant.donnees,
              organisations: avant.donnees.organisations.map((o) =>
                o.id === modifiee.id ? modifiee : o,
              ),
            },
          },
    )
  }, [])

  // Le statut affiche n'est plus le bon (autre onglet, autre session) : on recharge la liste.
  const surConflitStatut = useCallback((e: ErreurService) => {
    if (e.code === 'DEJA_SUSPENDUE' || e.code === 'PAS_SUSPENDUE') {
      setRelance((valeur) => valeur + 1)
    }
  }, [])

  const modifier = useCallback(
    async (id: string, corps: CorpsModificationOrganisation): Promise<boolean> => {
      const modifiee = await executerOrganisation(() => modifierOrganisation(id, corps))
      if (modifiee === null) {
        return false
      }
      remplacerOrganisation(modifiee)
      return true
    },
    [executerOrganisation, remplacerOrganisation],
  )

  const suspendre = useCallback(
    async (id: string): Promise<boolean> => {
      const modifiee = await executerOrganisation(
        () => suspendreOrganisation(id),
        surConflitStatut,
      )
      if (modifiee === null) {
        return false
      }
      remplacerOrganisation(modifiee)
      return true
    },
    [executerOrganisation, remplacerOrganisation, surConflitStatut],
  )

  const reactiver = useCallback(
    async (id: string): Promise<boolean> => {
      const modifiee = await executerOrganisation(
        () => reactiverOrganisation(id),
        surConflitStatut,
      )
      if (modifiee === null) {
        return false
      }
      remplacerOrganisation(modifiee)
      return true
    },
    [executerOrganisation, remplacerOrganisation, surConflitStatut],
  )

  // --- Invitation du premier responsable ---------------------------------------------------------

  const { executer: executerInvitation, reinitialiserEtat: reinitialiserEtatInvitation } =
    actionInvitation

  const inviter = useCallback(
    async (organisationId: string, email: string): Promise<boolean> => {
      setResultatInvitation(null)
      const resultat = await executerInvitation(() => inviterResponsable(organisationId, { email }))
      if (resultat === null) {
        return false
      }
      setResultatInvitation(resultat)
      return true
    },
    [executerInvitation],
  )

  const reinitialiserInvitation = useCallback(() => {
    setResultatInvitation(null)
    reinitialiserEtatInvitation()
  }, [reinitialiserEtatInvitation])

  return {
    acces,
    filtres,
    appliquerFiltres,
    allerPage,
    organisations: reponse?.donnees.organisations ?? null,
    pagination: reponse?.donnees.pagination ?? null,
    chargement:
      acces !== 'aucun' &&
      erreur === null &&
      (reponse === null || reponse.cle !== construireCle(filtres, relance)),
    erreur,
    secteurs,
    erreurSecteurs,
    recharger,
    creation: {
      enCours: actionCreation.enCours,
      succes: actionCreation.succes,
      erreur: actionCreation.erreur,
      creer,
      reinitialiser: reinitialiserEtatCreation,
    },
    actions: {
      enCours: actionOrganisation.enCours,
      succes: actionOrganisation.succes,
      erreur: actionOrganisation.erreur,
      modifier,
      suspendre,
      reactiver,
      reinitialiser: reinitialiserEtatOrganisation,
    },
    invitation: {
      enCours: actionInvitation.enCours,
      succes: actionInvitation.succes,
      erreur: actionInvitation.erreur,
      resultat: resultatInvitation,
      inviter,
      reinitialiser: reinitialiserInvitation,
    },
  }
}