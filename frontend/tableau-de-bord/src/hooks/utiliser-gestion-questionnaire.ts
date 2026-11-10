import { useCallback, useEffect, useState } from 'react'
import { ErreurService } from '../services/api'
import { listerPointsContact } from '../services/points-contact'
import {
  activerQuestionnaire,
  associerPointsContact,
  desactiverQuestionnaire,
  lireQuestionnaire,
  modifierDatesQuestionnaire,
  publierQuestionnaire,
  supprimerQuestionnaire,
} from '../services/questionnaires'
import type { FicheQuestionnaire } from '../types/questionnaires'
import type { PointContact } from '../types/sites-points'
import type { EtatAction } from './utiliser-sites-points'
import { utiliserUtilisateur } from './utiliser-utilisateur'

// Gestion d'un questionnaire deja enregistre (editeur E10, jour 20), au meme endroit :
// - la fiche a jour : statut, dates, version publiee, points de contact associes ;
// - les points de contact de l'organisation, pour choisir ceux du questionnaire ;
// - les actions : publier, activer, desactiver, dates, points de contact, supprimer.
// Le hook ne dessine rien : le panneau de publication et la page lui donnent les saisies
// et affichent ce qu'il renvoie.
// - id null (questionnaire pas encore cree) : aucun appel, rien n'est charge.
// - la page doit recreer l'ecran (key) quand l'identifiant change.
// - apres chaque action reussie, la fiche est relue depuis le serveur (jamais devinee) ;
//   l'ancienne fiche reste affichee pendant la relecture.
// - apres un enregistrement du contenu par l'editeur (une nouvelle version peut avoir ete creee),
//   la page appelle recharger() pour relire la fiche.
// Seul le Responsable gere les questionnaires (acces = 'aucun' pour les autres : aucun appel).
// Une session expiree (401) renvoie a la page de connexion.

export type AccesGestion = 'responsable' | 'aucun'

export type ActionPublication = EtatAction & {
  // Publie la derniere version et active le questionnaire. Renvoie true si c'est fait.
  publier: () => Promise<boolean>
}

export type ActionStatut = EtatAction & {
  // Reactive le questionnaire (erreur 409 NON_PUBLIE s'il n'a jamais ete publie).
  activer: () => Promise<boolean>
  // Desactive le questionnaire : les avis et les versions sont conserves.
  desactiver: () => Promise<boolean>
}

export type ActionDates = EtatAction & {
  // Dates au format ISO avec fuseau (2026-12-01T08:00:00Z) ou null = pas de date.
  // Renvoie true si c'est fait.
  enregistrer: (dateDebut: string | null, dateFin: string | null) => Promise<boolean>
}

export type ActionPointsContact = EtatAction & {
  // Remplace la liste complete des points de contact du questionnaire. Renvoie true si c'est fait.
  enregistrer: (pointsContactIds: string[]) => Promise<boolean>
}

export type ActionSuppression = EtatAction & {
  // Nombre d'avis recus quand la suppression est refusee (409) ; sinon null.
  // Le questionnaire doit alors etre desactive au lieu d'etre supprime.
  nombreAvis: number | null
  // Suppression douce, seulement sans avis. Renvoie true si c'est fait : la page quitte alors l'editeur.
  supprimer: () => Promise<boolean>
}

export type ResultatGestionQuestionnaire = {
  acces: AccesGestion
  // Fiche a jour ; null tant qu'elle n'est pas chargee (ou en cas d'erreur).
  fiche: FicheQuestionnaire | null
  chargement: boolean
  // Erreur du chargement de la fiche (null = tout va bien). Statut 404 : le questionnaire n'existe plus.
  erreur: ErreurService | null
  // Points de contact de l'organisation ; null tant qu'ils ne sont pas charges.
  // Un echec ne bloque pas le reste : seul le choix des points est indisponible.
  pointsDisponibles: PointContact[] | null
  erreurPoints: boolean
  // Relit la fiche et les points de contact (bouton "Reessayer", ou apres un enregistrement du contenu).
  recharger: () => void
  publication: ActionPublication
  statut: ActionStatut
  dates: ActionDates
  pointsContact: ActionPointsContact
  suppression: ActionSuppression
}

// Resultat du dernier chargement, avec l'id demande : sert a ne jamais montrer la fiche d'un autre questionnaire
type Chargement = {
  id: string
  fiche: FicheQuestionnaire | null
  erreur: ErreurService | null
}

function versErreurService(erreur: unknown): ErreurService {
  if (erreur instanceof ErreurService) {
    return erreur
  }
  return new ErreurService(0, 'ERREUR_INCONNUE', 'Une erreur est survenue.', null)
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

// Le serveur refuse la suppression avec un 409 dont les details donnent le nombre d'avis.
function nombreAvisDepuisErreur(erreur: ErreurService | null): number | null {
  if (erreur === null || erreur.code !== 'QUESTIONNAIRE_AVEC_AVIS') {
    return null
  }
  const details: unknown = erreur.details
  if (typeof details !== 'object' || details === null) {
    return null
  }
  const { nombre_avis: nombre } = details as { nombre_avis?: unknown }
  return typeof nombre === 'number' ? nombre : null
}

export function utiliserGestionQuestionnaire(id: string | null): ResultatGestionQuestionnaire {
  const { utilisateur, seDeconnecter } = utiliserUtilisateur()

  const acces: AccesGestion = utilisateur?.role === 'RESPONSABLE' ? 'responsable' : 'aucun'
  const actif = id !== null && acces === 'responsable'

  const [dernier, setDernier] = useState<Chargement | null>(null)
  const [points, setPoints] = useState<PointContact[] | null>(null)
  const [erreurPoints, setErreurPoints] = useState(false)
  // Augmentent apres une action reussie (fiche) ou un clic sur "Reessayer" (les deux).
  const [relance, setRelance] = useState(0)
  const [relancePoints, setRelancePoints] = useState(0)

  const actionPublication = utiliserAction(seDeconnecter)
  const actionStatut = utiliserAction(seDeconnecter)
  const actionDates = utiliserAction(seDeconnecter)
  const actionPoints = utiliserAction(seDeconnecter)
  const actionSuppression = utiliserAction(seDeconnecter)

  // --- Chargement de la fiche ------------------------------------------------------------------

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
        setDernier({ id: idDemande, fiche, erreur: null })
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
        setDernier({ id: idDemande, fiche: null, erreur: erreurService })
      }
    }

    void charger(id)

    return () => {
      annule = true
    }
  }, [id, acces, relance, seDeconnecter])

  // --- Chargement des points de contact --------------------------------------------------------

  useEffect(() => {
    if (id === null || acces !== 'responsable') {
      return
    }

    let annule = false

    async function charger(): Promise<void> {
      try {
        const resultat = await listerPointsContact()
        if (annule) {
          return
        }
        setPoints(resultat)
        setErreurPoints(false)
      } catch (e) {
        if (annule) {
          return
        }
        if (versErreurService(e).statut === 401) {
          void seDeconnecter()
          return
        }
        // Sans la liste, le reste marche quand meme : seul le choix des points est indisponible.
        setErreurPoints(true)
      }
    }

    void charger()

    return () => {
      annule = true
    }
  }, [id, acces, relancePoints, seDeconnecter])

  const recharger = useCallback(() => {
    // Une erreur de chargement est effacee : le panneau repasse en chargement.
    setDernier((avant) => (avant !== null && avant.erreur !== null ? null : avant))
    setErreurPoints(false)
    setRelance((valeur) => valeur + 1)
    setRelancePoints((valeur) => valeur + 1)
  }, [])

  // --- Actions ---------------------------------------------------------------------------------

  const { executer: executerPublication } = actionPublication
  const { executer: executerStatut } = actionStatut
  const { executer: executerDates } = actionDates
  const { executer: executerPoints } = actionPoints
  const { executer: executerSuppression } = actionSuppression

  const publier = useCallback(async (): Promise<boolean> => {
    if (id === null) {
      return false
    }
    const resultat = await executerPublication(() => publierQuestionnaire(id))
    if (resultat === null) {
      return false
    }
    setRelance((valeur) => valeur + 1)
    return true
  }, [id, executerPublication])

  const activer = useCallback(async (): Promise<boolean> => {
    if (id === null) {
      return false
    }
    const resultat = await executerStatut(() => activerQuestionnaire(id))
    if (resultat === null) {
      return false
    }
    setRelance((valeur) => valeur + 1)
    return true
  }, [id, executerStatut])

  const desactiver = useCallback(async (): Promise<boolean> => {
    if (id === null) {
      return false
    }
    const resultat = await executerStatut(() => desactiverQuestionnaire(id))
    if (resultat === null) {
      return false
    }
    setRelance((valeur) => valeur + 1)
    return true
  }, [id, executerStatut])

  const enregistrerDates = useCallback(
    async (dateDebut: string | null, dateFin: string | null): Promise<boolean> => {
      if (id === null) {
        return false
      }
      const resultat = await executerDates(() =>
        modifierDatesQuestionnaire(id, { date_debut: dateDebut, date_fin: dateFin }),
      )
      if (resultat === null) {
        return false
      }
      setRelance((valeur) => valeur + 1)
      return true
    },
    [id, executerDates],
  )

  const enregistrerPoints = useCallback(
    async (pointsContactIds: string[]): Promise<boolean> => {
      if (id === null) {
        return false
      }
      const resultat = await executerPoints(() => associerPointsContact(id, pointsContactIds))
      if (resultat === null) {
        return false
      }
      // Le questionnaire de chaque point a change : on relit la fiche et la liste des points.
      setRelance((valeur) => valeur + 1)
      setRelancePoints((valeur) => valeur + 1)
      return true
    },
    [id, executerPoints],
  )

  const supprimer = useCallback(async (): Promise<boolean> => {
    if (id === null) {
      return false
    }
    // Pas de relecture : le questionnaire n'existe plus, la page quitte l'editeur.
    const resultat = await executerSuppression(() => supprimerQuestionnaire(id))
    return resultat !== null
  }, [id, executerSuppression])

  // Seul le resultat du questionnaire actuellement affiche compte
  const courant = actif && dernier !== null && dernier.id === id ? dernier : null

  return {
    acces,
    fiche: courant !== null ? courant.fiche : null,
    chargement: actif && courant === null,
    erreur: courant !== null ? courant.erreur : null,
    pointsDisponibles: actif ? points : null,
    erreurPoints: actif && erreurPoints,
    recharger,
    publication: {
      enCours: actionPublication.enCours,
      succes: actionPublication.succes,
      erreur: actionPublication.erreur,
      publier,
    },
    statut: {
      enCours: actionStatut.enCours,
      succes: actionStatut.succes,
      erreur: actionStatut.erreur,
      activer,
      desactiver,
    },
    dates: {
      enCours: actionDates.enCours,
      succes: actionDates.succes,
      erreur: actionDates.erreur,
      enregistrer: enregistrerDates,
    },
    pointsContact: {
      enCours: actionPoints.enCours,
      succes: actionPoints.succes,
      erreur: actionPoints.erreur,
      enregistrer: enregistrerPoints,
    },
    suppression: {
      enCours: actionSuppression.enCours,
      succes: actionSuppression.succes,
      erreur: actionSuppression.erreur,
      nombreAvis: nombreAvisDepuisErreur(actionSuppression.erreur),
      supprimer,
    },
  }
}