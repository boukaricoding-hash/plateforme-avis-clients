import { useCallback, useEffect, useState } from 'react'
import { ErreurService } from '../services/api'
import {
  activerPointContact,
  creerPointsContactEnMasse,
  desactiverPointContact,
  listerPointsContact,
  modifierPointContact,
} from '../services/points-contact'
import { listerQuestionnaires } from '../services/questionnaires'
import {
  activerSite,
  creerSite,
  desactiverSite,
  listerSites,
  modifierSite,
} from '../services/sites'
import type { ResumeQuestionnaire } from '../types/questionnaires'
import type {
  CorpsCreationMasse,
  CorpsCreationSite,
  CorpsModificationPointContact,
  CorpsModificationSite,
  PointContact,
  ReponseCreationMasse,
  Site,
} from '../types/sites-points'
import { utiliserUtilisateur } from './utiliser-utilisateur'

// Toutes les donnees de l'ecran E12 (sites et points de contact, jour 17), au meme endroit :
// - les sites de l'organisation et le site choisi (le premier par defaut) ;
// - les points de contact du site choisi ;
// - les questionnaires de l'organisation, pour choisir le questionnaire d'un point ;
// - les actions (sites, points, creation en masse) avec leur etat : en cours, succes, erreur.
// Le Responsable peut tout modifier ; le Gestionnaire lit seulement (le serveur refuse ses
// ecritures avec un 403, et la page cache les boutons).
// Le hook ne fait aucun appel a l'API pour l'administrateur DTS : il n'a pas d'organisation,
// l'API lui refuse ces routes. La page doit le renvoyer ailleurs (acces = 'aucun').
// Une session expiree (401) renvoie a la page de connexion.

// Qui voit quoi : le Responsable modifie, le Gestionnaire lit seulement.
export type AccesSitesPoints = 'responsable' | 'gestionnaire' | 'aucun'

// Etat d'une action : les boutons se bloquent pendant qu'elle est en cours.
export type EtatAction = {
  enCours: boolean
  // Derniere action reussie ; false des qu'une nouvelle action commence.
  succes: boolean
  erreur: ErreurService | null
}

export type ActionsSites = EtatAction & {
  // Cree un site et le choisit. Renvoie true si c'est fait.
  creer: (corps: CorpsCreationSite) => Promise<boolean>
  // Seuls les champs a changer sont envoyes (au moins un). Renvoie true si c'est fait.
  modifier: (id: string, corps: CorpsModificationSite) => Promise<boolean>
  // true : activer le site ; false : le desactiver. Renvoie true si c'est fait.
  changerStatut: (id: string, actif: boolean) => Promise<boolean>
}

export type ActionsPoints = EtatAction & {
  // Seuls les champs a changer sont envoyes (au moins un). Renvoie true si c'est fait.
  modifier: (id: string, corps: CorpsModificationPointContact) => Promise<boolean>
  // true : activer le point ; false : le desactiver. Renvoie true si c'est fait.
  changerStatut: (id: string, actif: boolean) => Promise<boolean>
}

export type ActionMasse = EtatAction & {
  // Nombre de points crees et deja existants, apres une creation reussie ; sinon null.
  resultat: ReponseCreationMasse | null
  // Cree "Table 1" a "Table N" ; la liste des points se recharge ensuite.
  creer: (corps: CorpsCreationMasse) => Promise<boolean>
}

export type ResultatSitesPoints = {
  acces: AccesSitesPoints
  // Vrai pour le Responsable : lui seul voit les boutons de modification.
  peutModifier: boolean
  // Sites de l'organisation (ou du perimetre du Gestionnaire) ; null tant qu'ils ne sont pas charges.
  sites: Site[] | null
  chargementSites: boolean
  // Erreur du chargement des sites (null = tout va bien).
  erreurSites: ErreurService | null
  // Site choisi ; null s'il n'y a aucun site.
  siteChoisi: Site | null
  choisirSite: (id: string) => void
  // Points de contact du site choisi ; null tant qu'ils ne sont pas charges.
  points: PointContact[] | null
  chargementPoints: boolean
  erreurPoints: ErreurService | null
  // Questionnaires de l'organisation ; null tant qu'ils ne sont pas charges.
  // Un echec ici ne bloque pas l'ecran : le choix du questionnaire est seulement indisponible.
  questionnaires: ResumeQuestionnaire[] | null
  erreurQuestionnaires: ErreurService | null
  // Relance les chargements (bouton "Reessayer").
  recharger: () => void
  actionsSites: ActionsSites
  actionsPoints: ActionsPoints
  masse: ActionMasse
}

function versErreurService(erreur: unknown): ErreurService {
  if (erreur instanceof ErreurService) {
    return erreur
  }
  return new ErreurService(0, 'ERREUR_INCONNUE', 'Une erreur est survenue.', null)
}

// Tri des sites par nom, comme le serveur.
function trierSites(sites: Site[]): Site[] {
  return [...sites].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
}

// Tri des points par nom avec les nombres dans l'ordre : Table 2 avant Table 10.
function trierPoints(points: PointContact[]): PointContact[] {
  return [...points].sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { numeric: true }))
}

// Etat commun d'une action (en cours, succes, erreur) et son execution.
// Une session expiree (401) deconnecte l'utilisateur ; l'action renvoie alors null.
function utiliserAction(seDeconnecter: () => Promise<void>) {
  const [enCours, setEnCours] = useState(false)
  const [succes, setSucces] = useState(false)
  const [erreur, setErreur] = useState<ErreurService | null>(null)

  const executer = useCallback(
    async <T>(appel: () => Promise<T>): Promise<T | null> => {
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
        setErreur(erreurService)
        return null
      } finally {
        setEnCours(false)
      }
    },
    [seDeconnecter],
  )

  return { enCours, succes, erreur, executer }
}

export function utiliserSitesPoints(): ResultatSitesPoints {
  const { utilisateur, seDeconnecter } = utiliserUtilisateur()

  const role = utilisateur?.role ?? null
  const acces: AccesSitesPoints =
    role === 'RESPONSABLE' ? 'responsable' : role === 'GESTIONNAIRE' ? 'gestionnaire' : 'aucun'

  const [sites, setSites] = useState<Site[] | null>(null)
  const [erreurSites, setErreurSites] = useState<ErreurService | null>(null)
  const [siteChoisiId, setSiteChoisiId] = useState<string | null>(null)
  // Les points sont gardes avec le site auquel ils appartiennent : ceux d'un autre site ne s'affichent jamais.
  const [pointsCharges, setPointsCharges] = useState<{
    siteId: string
    liste: PointContact[]
  } | null>(null)
  const [erreurPoints, setErreurPoints] = useState<ErreurService | null>(null)
  const [questionnaires, setQuestionnaires] = useState<ResumeQuestionnaire[] | null>(null)
  const [erreurQuestionnaires, setErreurQuestionnaires] = useState<ErreurService | null>(null)
  // Augmente a chaque clic sur "Reessayer" pour relancer les chargements.
  const [relance, setRelance] = useState(0)
  // Augmente apres une creation en masse pour recharger les points.
  const [relancePoints, setRelancePoints] = useState(0)
  const [resultatMasse, setResultatMasse] = useState<ReponseCreationMasse | null>(null)

  const actionSites = utiliserAction(seDeconnecter)
  const actionPoints = utiliserAction(seDeconnecter)
  const actionMasse = utiliserAction(seDeconnecter)

  // Site choisi : celui demande s'il existe encore, sinon le premier de la liste.
  const siteChoisi = sites?.find((site) => site.id === siteChoisiId) ?? sites?.[0] ?? null
  const idSiteChoisi = siteChoisi?.id ?? null

  const choisirSite = useCallback((id: string) => {
    setErreurPoints(null)
    setResultatMasse(null)
    setSiteChoisiId(id)
  }, [])

  const recharger = useCallback(() => {
    setErreurSites(null)
    setErreurPoints(null)
    setErreurQuestionnaires(null)
    setRelance((valeur) => valeur + 1)
  }, [])

  // --- Chargement des sites ---------------------------------------------------------------

  useEffect(() => {
    if (acces === 'aucun') {
      return
    }

    let annule = false

    async function charger(): Promise<void> {
      try {
        const resultat = await listerSites()
        if (annule) {
          return
        }
        setSites(trierSites(resultat))
        setErreurSites(null)
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
        setErreurSites(erreurService)
      }
    }

    void charger()

    return () => {
      annule = true
    }
  }, [acces, relance, seDeconnecter])

  // --- Chargement des points du site choisi -------------------------------------------------

  useEffect(() => {
    if (acces === 'aucun' || idSiteChoisi === null) {
      return
    }

    let annule = false

    async function charger(siteId: string): Promise<void> {
      try {
        const resultat = await listerPointsContact(siteId)
        if (annule) {
          return
        }
        setPointsCharges({ siteId, liste: trierPoints(resultat) })
        setErreurPoints(null)
      } catch (e) {
        if (annule) {
          return
        }
        const erreurService = versErreurService(e)
        if (erreurService.statut === 401) {
          void seDeconnecter()
          return
        }
        setErreurPoints(erreurService)
      }
    }

    void charger(idSiteChoisi)

    return () => {
      annule = true
    }
  }, [acces, idSiteChoisi, relance, relancePoints, seDeconnecter])

  // --- Chargement des questionnaires (pour le choix du questionnaire d'un point) ------------

  useEffect(() => {
    if (acces === 'aucun') {
      return
    }

    let annule = false

    async function charger(): Promise<void> {
      try {
        const resultat = await listerQuestionnaires()
        if (annule) {
          return
        }
        setQuestionnaires(resultat)
        setErreurQuestionnaires(null)
      } catch (e) {
        if (annule) {
          return
        }
        const erreurService = versErreurService(e)
        if (erreurService.statut === 401) {
          void seDeconnecter()
          return
        }
        setErreurQuestionnaires(erreurService)
      }
    }

    void charger()

    return () => {
      annule = true
    }
  }, [acces, relance, seDeconnecter])

  // --- Actions sur les sites ---------------------------------------------------------------

  const { executer: executerSite } = actionSites

  const creerUnSite = useCallback(
    async (corps: CorpsCreationSite): Promise<boolean> => {
      const site = await executerSite(() => creerSite(corps))
      if (site === null) {
        return false
      }
      setSites((avant) => trierSites([...(avant ?? []), site]))
      choisirSite(site.id)
      return true
    },
    [executerSite, choisirSite],
  )

  const modifierUnSite = useCallback(
    async (id: string, corps: CorpsModificationSite): Promise<boolean> => {
      const site = await executerSite(() => modifierSite(id, corps))
      if (site === null) {
        return false
      }
      setSites((avant) =>
        avant === null ? avant : trierSites(avant.map((s) => (s.id === site.id ? site : s))),
      )
      return true
    },
    [executerSite],
  )

  const changerStatutSite = useCallback(
    async (id: string, actif: boolean): Promise<boolean> => {
      const site = await executerSite(() => (actif ? activerSite(id) : desactiverSite(id)))
      if (site === null) {
        return false
      }
      setSites((avant) => (avant === null ? avant : avant.map((s) => (s.id === site.id ? site : s))))
      return true
    },
    [executerSite],
  )

  // --- Actions sur les points de contact -----------------------------------------------------

  const { executer: executerPoint } = actionPoints

  const remplacerPoint = useCallback((point: PointContact) => {
    setPointsCharges((avant) =>
      avant === null
        ? avant
        : {
            ...avant,
            liste: trierPoints(avant.liste.map((p) => (p.id === point.id ? point : p))),
          },
    )
  }, [])

  const modifierUnPoint = useCallback(
    async (id: string, corps: CorpsModificationPointContact): Promise<boolean> => {
      const point = await executerPoint(() => modifierPointContact(id, corps))
      if (point === null) {
        return false
      }
      remplacerPoint(point)
      return true
    },
    [executerPoint, remplacerPoint],
  )

  const changerStatutPoint = useCallback(
    async (id: string, actif: boolean): Promise<boolean> => {
      const point = await executerPoint(() =>
        actif ? activerPointContact(id) : desactiverPointContact(id),
      )
      if (point === null) {
        return false
      }
      remplacerPoint(point)
      return true
    },
    [executerPoint, remplacerPoint],
  )

  // --- Creation en masse -----------------------------------------------------------------------

  const { executer: executerMasse } = actionMasse

  const creerEnMasse = useCallback(
    async (corps: CorpsCreationMasse): Promise<boolean> => {
      setResultatMasse(null)
      const resultat = await executerMasse(() => creerPointsContactEnMasse(corps))
      if (resultat === null) {
        return false
      }
      setResultatMasse(resultat)
      // Le serveur ne renvoie que les nombres : on recharge la liste des points.
      setRelancePoints((valeur) => valeur + 1)
      return true
    },
    [executerMasse],
  )

  const points =
    pointsCharges !== null && pointsCharges.siteId === idSiteChoisi ? pointsCharges.liste : null

  return {
    acces,
    peutModifier: acces === 'responsable',
    sites,
    chargementSites: acces !== 'aucun' && sites === null && erreurSites === null,
    erreurSites,
    siteChoisi,
    choisirSite,
    points,
    chargementPoints: idSiteChoisi !== null && points === null && erreurPoints === null,
    erreurPoints,
    questionnaires,
    erreurQuestionnaires,
    recharger,
    actionsSites: {
      enCours: actionSites.enCours,
      succes: actionSites.succes,
      erreur: actionSites.erreur,
      creer: creerUnSite,
      modifier: modifierUnSite,
      changerStatut: changerStatutSite,
    },
    actionsPoints: {
      enCours: actionPoints.enCours,
      succes: actionPoints.succes,
      erreur: actionPoints.erreur,
      modifier: modifierUnPoint,
      changerStatut: changerStatutPoint,
    },
    masse: {
      enCours: actionMasse.enCours,
      succes: actionMasse.succes,
      erreur: actionMasse.erreur,
      resultat: resultatMasse,
      creer: creerEnMasse,
    },
  }
}