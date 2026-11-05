import { useCallback, useEffect, useState } from 'react'
import { ErreurService } from '../services/api'
import { listerNotifications, marquerNotificationLue } from '../services/notifications'
import type { NotificationRecue, ReponseListeNotifications } from '../types/notifications'
import { utiliserUtilisateur } from './utiliser-utilisateur'

// Toutes les donnees de la cloche de notifications (jour 16), au meme endroit :
// - les 20 notifications les plus recentes de l'utilisateur et le compteur de non lues ;
// - l'actualisation toutes les 30 secondes, sans faire clignoter la cloche
//   (les anciennes donnees restent affichees pendant le rechargement), en pause si l'onglet est cache ;
// - marquer une notification comme lue (la liste et le compteur se mettent a jour tout de suite) ;
// - les erreurs : avec des donnees deja affichees, elles restent a l'ecran avec un avertissement.
// A utiliser seulement pour un Responsable ou un Gestionnaire : l'administrateur DTS n'a pas
// d'organisation, l'API lui refuse les notifications (la cloche n'est pas affichee pour lui).

const INTERVALLE_ACTUALISATION_MS = 30000
const NOMBRE_AFFICHE = 20

export type ResultatNotifications = {
  // Les plus recentes d'abord.
  notifications: NotificationRecue[]
  // Compteur de la cloche (toutes les non lues, meme au-dela des notifications affichees).
  nonLues: number
  // Vrai s'il existe plus de notifications que celles affichees.
  tronque: boolean
  // Vrai tant qu'on attend la toute premiere reponse.
  chargementInitial: boolean
  // Erreur du dernier chargement (null = tout va bien).
  erreur: ErreurService | null
  // Erreur de la derniere tentative pour marquer une notification comme lue.
  erreurLecture: ErreurService | null
  actualiser: () => void
  // Renvoie true si la notification a ete marquee comme lue.
  marquerLue: (id: string) => Promise<boolean>
}

function versErreurService(erreur: unknown): ErreurService {
  if (erreur instanceof ErreurService) {
    return erreur
  }
  return new ErreurService(0, 'ERREUR_INCONNUE', 'Une erreur est survenue.', null)
}

export function utiliserNotifications(): ResultatNotifications {
  const { seDeconnecter } = utiliserUtilisateur()

  const [donnees, setDonnees] = useState<ReponseListeNotifications | null>(null)
  const [erreur, setErreur] = useState<ErreurService | null>(null)
  const [erreurLecture, setErreurLecture] = useState<ErreurService | null>(null)
  // Augmente a chaque clic sur "Reessayer" pour relancer le chargement.
  const [relance, setRelance] = useState(0)

  const actualiser = useCallback(() => {
    setRelance((valeur) => valeur + 1)
  }, [])

  // --- Chargement et actualisation automatique -------------------------------

  useEffect(() => {
    let annule = false
    let enVol = false

    async function charger(): Promise<void> {
      if (enVol) {
        return
      }
      enVol = true
      try {
        const resultat = await listerNotifications({ limite: NOMBRE_AFFICHE })
        if (annule) {
          return
        }
        setDonnees(resultat)
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
        // Les donnees deja affichees restent a l'ecran.
        setErreur(erreurService)
      } finally {
        enVol = false
      }
    }

    void charger()

    // Actualisation automatique, sauf si l'onglet du navigateur est cache.
    const minuteur = window.setInterval(() => {
      if (!document.hidden) {
        void charger()
      }
    }, INTERVALLE_ACTUALISATION_MS)

    // Retour sur l'onglet : on remet la cloche a jour tout de suite.
    function auChangementDeVisibilite(): void {
      if (!document.hidden) {
        void charger()
      }
    }
    document.addEventListener('visibilitychange', auChangementDeVisibilite)

    return () => {
      annule = true
      window.clearInterval(minuteur)
      document.removeEventListener('visibilitychange', auChangementDeVisibilite)
    }
  }, [relance, seDeconnecter])

  // --- Marquer une notification comme lue ------------------------------------

  const marquerLue = useCallback(
    async (id: string): Promise<boolean> => {
      setErreurLecture(null)
      try {
        const miseAJour = await marquerNotificationLue(id)
        setDonnees((avant) => {
          if (avant === null) {
            return avant
          }
          const ancienne = avant.notifications.find((notification) => notification.id === id)
          // Le compteur baisse seulement si la notification etait vraiment non lue ici.
          const etaitNonLue = ancienne !== undefined && ancienne.lue_le === null
          return {
            ...avant,
            notifications: avant.notifications.map((notification) =>
              notification.id === id ? miseAJour : notification,
            ),
            non_lues: etaitNonLue ? Math.max(0, avant.non_lues - 1) : avant.non_lues,
          }
        })
        return true
      } catch (e) {
        const erreurService = versErreurService(e)
        if (erreurService.statut === 401) {
          void seDeconnecter()
          return false
        }
        setErreurLecture(erreurService)
        return false
      }
    },
    [seDeconnecter],
  )

  return {
    notifications: donnees?.notifications ?? [],
    nonLues: donnees?.non_lues ?? 0,
    tronque: donnees !== null && donnees.pagination.total > donnees.notifications.length,
    chargementInitial: donnees === null && erreur === null,
    erreur,
    erreurLecture,
    actualiser,
    marquerLue,
  }
}