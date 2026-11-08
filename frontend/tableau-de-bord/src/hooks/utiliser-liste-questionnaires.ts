import { useCallback, useEffect, useState } from 'react'
import { ErreurService } from '../services/api'
import {
  clonerModele,
  dupliquerQuestionnaire,
  listerModeles,
  listerQuestionnaires,
  supprimerQuestionnaire,
} from '../services/questionnaires'
import type { ModeleQuestionnaire, ResumeQuestionnaire } from '../types/questionnaires'
import type { EtatAction } from './utiliser-sites-points'
import { utiliserUtilisateur } from './utiliser-utilisateur'

// Toutes les donnees de la liste des questionnaires (ecran E10, jour 19), au meme endroit :
// - les questionnaires de l'organisation ;
// - les modeles sectoriels, pour le Responsable seulement (lui seul peut les cloner) ;
// - les actions cloner un modele, dupliquer et supprimer un questionnaire, avec leur etat.
// Le Responsable et le Gestionnaire lisent la liste ; seul le Responsable cree, clone, duplique
// et supprime (le serveur refuse le Gestionnaire avec une erreur 403). L'administrateur DTS n'a pas
// d'organisation : le hook ne fait alors aucun appel et la page doit le renvoyer ailleurs
// (acces = 'aucun').
// Une session expiree (401) renvoie a la page de connexion.

export type AccesQuestionnaires = 'responsable' | 'gestionnaire' | 'aucun'

export type ActionClonage = EtatAction & {
  // Copie le modele en nouveau brouillon. Renvoie l'identifiant de la copie, ou null si ca a echoue.
  cloner: (modeleId: string) => Promise<string | null>
}

export type ActionDuplication = EtatAction & {
  // Copie le questionnaire en nouveau brouillon et recharge la liste.
  // Renvoie l'identifiant de la copie, ou null si ca a echoue.
  dupliquer: (id: string) => Promise<string | null>
}

export type ActionSuppressionListe = EtatAction & {
  // Nombre d'avis recus quand la suppression est refusee (409) ; sinon null.
  // Le questionnaire doit alors etre desactive au lieu d'etre supprime.
  nombreAvis: number | null
  // Suppression douce, seulement sans avis, puis rechargement de la liste.
  // Renvoie true si c'est fait, false si ca a echoue.
  supprimer: (id: string) => Promise<boolean>
}

export type ResultatListeQuestionnaires = {
  acces: AccesQuestionnaires
  // Vrai pour le Responsable : creer, cloner, dupliquer et modifier.
  peutModifier: boolean
  // Questionnaires de l'organisation ; null tant qu'ils ne sont pas charges.
  questionnaires: ResumeQuestionnaire[] | null
  chargement: boolean
  // Erreur du chargement de la liste (null = tout va bien).
  erreur: ErreurService | null
  // Modeles du secteur ; null tant qu'ils ne sont pas charges (et toujours null hors Responsable).
  // Un echec ici ne bloque pas la liste : seul le choix d'un modele est indisponible.
  modeles: ModeleQuestionnaire[] | null
  chargementModeles: boolean
  erreurModeles: ErreurService | null
  // Relance les chargements (bouton "Reessayer").
  recharger: () => void
  clonage: ActionClonage
  duplication: ActionDuplication
  suppression: ActionSuppressionListe
}

function versErreurService(erreur: unknown): ErreurService {
  if (erreur instanceof ErreurService) {
    return erreur
  }
  return new ErreurService(0, 'ERREUR_INCONNUE', 'Une erreur est survenue.', null)
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

export function utiliserListeQuestionnaires(): ResultatListeQuestionnaires {
  const { utilisateur, seDeconnecter } = utiliserUtilisateur()

  const role = utilisateur?.role ?? null
  const acces: AccesQuestionnaires =
    role === 'RESPONSABLE' ? 'responsable' : role === 'GESTIONNAIRE' ? 'gestionnaire' : 'aucun'

  const [questionnaires, setQuestionnaires] = useState<ResumeQuestionnaire[] | null>(null)
  const [erreur, setErreur] = useState<ErreurService | null>(null)
  const [modeles, setModeles] = useState<ModeleQuestionnaire[] | null>(null)
  const [erreurModeles, setErreurModeles] = useState<ErreurService | null>(null)
  // Augmentent a chaque clic sur "Reessayer" (les deux), ou apres une duplication
  // ou une suppression (la liste seule).
  const [relance, setRelance] = useState(0)
  const [relanceModeles, setRelanceModeles] = useState(0)

  const actionClonage = utiliserAction(seDeconnecter)
  const actionDuplication = utiliserAction(seDeconnecter)
  const actionSuppression = utiliserAction(seDeconnecter)

  const recharger = useCallback(() => {
    setErreur(null)
    setErreurModeles(null)
    setRelance((valeur) => valeur + 1)
    setRelanceModeles((valeur) => valeur + 1)
  }, [])

  // --- Chargement des questionnaires -----------------------------------------------------------

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
  }, [acces, relance, seDeconnecter])

  // --- Chargement des modeles (Responsable seulement) -----------------------------------------

  useEffect(() => {
    if (acces !== 'responsable') {
      return
    }

    let annule = false

    async function charger(): Promise<void> {
      try {
        const resultat = await listerModeles()
        if (annule) {
          return
        }
        setModeles(resultat)
        setErreurModeles(null)
      } catch (e) {
        if (annule) {
          return
        }
        const erreurService = versErreurService(e)
        if (erreurService.statut === 401) {
          void seDeconnecter()
          return
        }
        setErreurModeles(erreurService)
      }
    }

    void charger()

    return () => {
      annule = true
    }
  }, [acces, relanceModeles, seDeconnecter])

  // --- Cloner, dupliquer et supprimer un questionnaire -----------------------------------------

  const { executer: executerClonage } = actionClonage
  const { executer: executerDuplication } = actionDuplication
  const { executer: executerSuppression } = actionSuppression

  const cloner = useCallback(
    async (modeleId: string): Promise<string | null> => {
      const copie = await executerClonage(() => clonerModele(modeleId))
      return copie === null ? null : copie.id
    },
    [executerClonage],
  )

  const dupliquer = useCallback(
    async (id: string): Promise<string | null> => {
      const copie = await executerDuplication(() => dupliquerQuestionnaire(id))
      if (copie === null) {
        return null
      }
      // La copie est un nouveau brouillon : on recharge la liste plutot que de la deviner.
      setRelance((valeur) => valeur + 1)
      return copie.id
    },
    [executerDuplication],
  )

  const supprimer = useCallback(
    async (id: string): Promise<boolean> => {
      const resultat = await executerSuppression(() => supprimerQuestionnaire(id))
      if (resultat === null) {
        return false
      }
      // Le questionnaire a disparu de la liste : on la relit plutot que de la deviner.
      setRelance((valeur) => valeur + 1)
      return true
    },
    [executerSuppression],
  )

  return {
    acces,
    peutModifier: acces === 'responsable',
    questionnaires,
    chargement: acces !== 'aucun' && questionnaires === null && erreur === null,
    erreur,
    modeles,
    chargementModeles: acces === 'responsable' && modeles === null && erreurModeles === null,
    erreurModeles,
    recharger,
    clonage: {
      enCours: actionClonage.enCours,
      succes: actionClonage.succes,
      erreur: actionClonage.erreur,
      cloner,
    },
    duplication: {
      enCours: actionDuplication.enCours,
      succes: actionDuplication.succes,
      erreur: actionDuplication.erreur,
      dupliquer,
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