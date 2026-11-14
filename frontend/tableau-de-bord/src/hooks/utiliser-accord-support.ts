import { useCallback, useEffect, useState } from 'react'
import { ErreurService } from '../services/api'
import { accorderAccesSupport, lireAccordSupport, retirerAccesSupport } from '../services/suivi-dts'
import type { AccordSupport, DureeAccesSupport } from '../types/suivi-dts'
import { utiliserUtilisateur } from './utiliser-utilisateur'

// Toutes les donnees du bloc "Accord de support" de l'ecran E14 (parametres, jour 24) :
// - l'accord actif de l'organisation (ni retire, ni expire), ou aucun ;
// - les deux actions : donner l'accord (1 heure, 24 heures ou 7 jours) et le retirer.
// Seul le Responsable gere l'accord, et l'organisation vient toujours de sa session.
// Le hook ne fait aucun appel a l'API pour les autres roles ; la page n'affiche pas le bloc
// (acces = 'aucun').
// Un nouvel accord remplace l'accord actif. Chaque accord donne ou retire est ecrit dans le journal.
// Une session expiree (401) renvoie a la page de connexion.

export type AccesAccordSupport = 'responsable' | 'aucun'

// Les deux actions possibles : sert a savoir laquelle est en cours ou vient de reussir.
export type ActionAccordSupport = 'accorder' | 'retirer'

export type ResultatAccordSupport = {
  acces: AccesAccordSupport
  // L'accord actif ; null s'il n'y en a pas (ou tant qu'il n'est pas charge : voir chargement).
  accord: AccordSupport | null
  // Vrai tant que l'accord attend la reponse du serveur (premier chargement ou relance).
  chargement: boolean
  // Erreur du chargement (null = tout va bien).
  erreur: ErreurService | null
  // Relance le chargement (bouton "Reessayer").
  recharger: () => void
  // Action en cours (les boutons se bloquent) ; null = rien en cours.
  enCours: ActionAccordSupport | null
  // Derniere action reussie ; null des qu'une nouvelle action commence.
  succes: ActionAccordSupport | null
  // Erreur de la derniere action (null = tout va bien).
  erreurAction: ErreurService | null
  // Donne l'accord pour la duree choisie. Renvoie true si c'est fait.
  accorder: (duree: DureeAccesSupport) => Promise<boolean>
  // Retire l'accord actif. Renvoie true si c'est fait (ou s'il n'y en avait pas).
  retirer: () => Promise<boolean>
}

function versErreurService(erreur: unknown): ErreurService {
  if (erreur instanceof ErreurService) {
    return erreur
  }
  return new ErreurService(0, 'ERREUR_INCONNUE', 'Une erreur est survenue.', null)
}

// Un accord deja expire au moment de la lecture n'est plus actif : on l'ignore.
function accordEncoreValable(accord: AccordSupport | null): AccordSupport | null {
  if (accord === null || Date.parse(accord.expire_le) <= Date.now()) {
    return null
  }
  return accord
}

export function utiliserAccordSupport(): ResultatAccordSupport {
  const { utilisateur, seDeconnecter } = utiliserUtilisateur()

  const acces: AccesAccordSupport = utilisateur?.role === 'RESPONSABLE' ? 'responsable' : 'aucun'

  // La lecture garde le numero de la relance a laquelle elle repond : tant qu'ils different, on charge.
  const [lecture, setLecture] = useState<{ relance: number; accord: AccordSupport | null } | null>(
    null,
  )
  const [erreur, setErreur] = useState<ErreurService | null>(null)
  // Augmente a chaque clic sur "Reessayer" pour recharger.
  const [relance, setRelance] = useState(0)

  const [enCours, setEnCours] = useState<ActionAccordSupport | null>(null)
  const [succes, setSucces] = useState<ActionAccordSupport | null>(null)
  const [erreurAction, setErreurAction] = useState<ErreurService | null>(null)

  const recharger = useCallback(() => {
    setErreur(null)
    setRelance((valeur) => valeur + 1)
  }, [])

  // --- Chargement de l'accord actif (Responsable seulement) --------------------------------------

  useEffect(() => {
    if (acces === 'aucun') {
      return
    }

    let annule = false

    async function charger(): Promise<void> {
      try {
        const accord = await lireAccordSupport()
        if (annule) {
          return
        }
        setLecture({ relance, accord: accordEncoreValable(accord) })
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

  // --- Actions -----------------------------------------------------------------------------------

  const accorder = useCallback(
    async (duree: DureeAccesSupport): Promise<boolean> => {
      if (acces === 'aucun') {
        return false
      }
      setEnCours('accorder')
      setSucces(null)
      setErreurAction(null)
      try {
        const accord = await accorderAccesSupport(duree)
        setLecture({ relance, accord: accordEncoreValable(accord) })
        setErreur(null)
        setSucces('accorder')
        return true
      } catch (e) {
        const erreurService = versErreurService(e)
        if (erreurService.statut === 401) {
          void seDeconnecter()
        } else {
          setErreurAction(erreurService)
        }
        return false
      } finally {
        setEnCours(null)
      }
    },
    [acces, relance, seDeconnecter],
  )

  const retirer = useCallback(async (): Promise<boolean> => {
    if (acces === 'aucun') {
      return false
    }
    setEnCours('retirer')
    setSucces(null)
    setErreurAction(null)
    try {
      await retirerAccesSupport()
      setLecture({ relance, accord: null })
      setErreur(null)
      setSucces('retirer')
      return true
    } catch (e) {
      const erreurService = versErreurService(e)
      if (erreurService.statut === 401) {
        void seDeconnecter()
      } else {
        setErreurAction(erreurService)
      }
      return false
    } finally {
      setEnCours(null)
    }
  }, [acces, relance, seDeconnecter])

  return {
    acces,
    accord: lecture?.accord ?? null,
    chargement:
      acces !== 'aucun' && erreur === null && (lecture === null || lecture.relance !== relance),
    erreur,
    recharger,
    enCours,
    succes,
    erreurAction,
    accorder,
    retirer,
  }
}