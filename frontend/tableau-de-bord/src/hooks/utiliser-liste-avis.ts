import { useCallback, useEffect, useState } from 'react'
import { ErreurService } from '../services/api'
import { listerAvis } from '../services/avis'
import type { ParametresListeAvis } from '../services/avis'
import type { ReponseListeAvis } from '../types/avis'
import { utiliserUtilisateur } from './utiliser-utilisateur'

// Chargement de la liste des avis (ecran E8, jour 15).
// - A chaque changement de filtre, de tri ou de page, la liste est rechargee.
// - Pendant un rechargement, la liste deja affichee reste a l'ecran (pas de clignotement).
// - Si le chargement echoue, on n'affiche plus l'ancienne liste : elle ne correspondrait
//   plus aux filtres choisis. L'erreur est affichee avec un bouton pour reessayer.
// - Pas d'actualisation automatique : un responsable qui lit sa liste ne veut pas la voir bouger.
//   Le bouton d'actualisation relance le chargement a la demande.
// - Une page trop grande (adresse tapee a la main) donne une liste vide avec un total
//   superieur a zero : c'est l'ecran qui propose alors de revenir a la derniere page.

export type ResultatListeAvis = {
  // La derniere reponse de l'API (avis et pagination), ou null.
  reponse: ReponseListeAvis | null
  // Vrai tant qu'on attend la toute premiere reponse.
  chargementInitial: boolean
  // Vrai pendant tout chargement (premier, nouveau filtre, bouton Actualiser).
  chargementEnCours: boolean
  erreur: ErreurService | null
  // Relance le chargement avec les memes filtres.
  recharger: () => void
}

function versErreurService(erreur: unknown): ErreurService {
  if (erreur instanceof ErreurService) {
    return erreur
  }
  return new ErreurService(0, 'ERREUR_INCONNUE', 'Une erreur est survenue.', null)
}

// Les filtres viennent de utiliserFiltresAvis : l'objet ne change que si l'adresse change.
export function utiliserListeAvis(filtres: ParametresListeAvis): ResultatListeAvis {
  const { seDeconnecter } = utiliserUtilisateur()

  const [reponse, setReponse] = useState<ReponseListeAvis | null>(null)
  const [enCours, setEnCours] = useState(true)
  const [erreur, setErreur] = useState<ErreurService | null>(null)
  // Augmente a chaque clic sur "Actualiser" ou "Reessayer" pour relancer le chargement.
  const [relance, setRelance] = useState(0)

  const recharger = useCallback(() => {
    setRelance((valeur) => valeur + 1)
  }, [])

  useEffect(() => {
    let annule = false

    async function charger(): Promise<void> {
      setEnCours(true)
      try {
        const resultat = await listerAvis(filtres)
        if (annule) {
          return
        }
        setReponse(resultat)
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
        setReponse(null)
        setErreur(erreurService)
      } finally {
        if (!annule) {
          setEnCours(false)
        }
      }
    }

    void charger()

    // Si les filtres changent avant la reponse, l'ancienne reponse est ignoree.
    return () => {
      annule = true
    }
  }, [filtres, relance, seDeconnecter])

  return {
    reponse,
    chargementInitial: reponse === null && erreur === null,
    chargementEnCours: enCours,
    erreur,
    recharger,
  }
}