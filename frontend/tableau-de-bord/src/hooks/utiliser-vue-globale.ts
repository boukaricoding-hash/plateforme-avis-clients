import { useCallback, useEffect, useState } from 'react'
import { ErreurService } from '../services/api'
import { lireVueGlobale } from '../services/suivi-dts'
import type { ReponseVueGlobale } from '../types/suivi-dts'
import { utiliserUtilisateur } from './utiliser-utilisateur'

// Toutes les donnees de l'ecran E19 (vue globale de la plateforme, jour 24), au meme endroit :
// organisations par statut, utilisateurs actifs par role, avis par jour (30 jours)
// et erreurs recentes (7 jours). Un seul appel : GET /admin/vue-globale.
// Seul l'administrateur DTS a acces a cet ecran : le serveur refuse les autres roles (403).
// Le hook ne fait aucun appel a l'API pour les autres roles ; la page doit les renvoyer
// ailleurs (acces = 'aucun').
// Une session expiree (401) renvoie a la page de connexion.
// La vue se lit seulement : aucune action n'existe ici.

export type AccesVueGlobale = 'administrateur' | 'aucun'

export type ResultatVueGlobale = {
  acces: AccesVueGlobale
  // La vue globale ; null tant qu'elle n'est pas chargee.
  vue: ReponseVueGlobale | null
  // Vrai tant que la vue attend la reponse du serveur (premier chargement ou relance).
  // Apres une relance, l'ancienne vue reste disponible en attendant la nouvelle.
  chargement: boolean
  // Erreur du chargement (null = tout va bien).
  erreur: ErreurService | null
  // Relance le chargement (bouton "Reessayer" ou "Actualiser").
  recharger: () => void
}

function versErreurService(erreur: unknown): ErreurService {
  if (erreur instanceof ErreurService) {
    return erreur
  }
  return new ErreurService(0, 'ERREUR_INCONNUE', 'Une erreur est survenue.', null)
}

export function utiliserVueGlobale(): ResultatVueGlobale {
  const { utilisateur, seDeconnecter } = utiliserUtilisateur()

  const acces: AccesVueGlobale = utilisateur?.role === 'ADMINISTRATEUR' ? 'administrateur' : 'aucun'

  // La reponse garde le numero de la relance a laquelle elle repond : tant qu'ils different, on charge.
  const [reponse, setReponse] = useState<{ relance: number; donnees: ReponseVueGlobale } | null>(
    null,
  )
  const [erreur, setErreur] = useState<ErreurService | null>(null)
  // Augmente a chaque clic sur "Reessayer" ou "Actualiser" pour recharger.
  const [relance, setRelance] = useState(0)

  const recharger = useCallback(() => {
    setErreur(null)
    setRelance((valeur) => valeur + 1)
  }, [])

  useEffect(() => {
    // Pas d'appel pour un autre role.
    if (acces === 'aucun') {
      return
    }

    let annule = false

    async function charger(): Promise<void> {
      try {
        const donnees = await lireVueGlobale()
        if (annule) {
          return
        }
        setReponse({ relance, donnees })
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

  return {
    acces,
    vue: reponse?.donnees ?? null,
    chargement:
      acces !== 'aucun' && erreur === null && (reponse === null || reponse.relance !== relance),
    erreur,
    recharger,
  }
}