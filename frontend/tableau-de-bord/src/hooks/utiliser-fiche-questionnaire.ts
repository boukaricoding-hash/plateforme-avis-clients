import { useCallback, useEffect, useState } from 'react'
import { ErreurService } from '../services/api'
import { lireQuestionnaire } from '../services/questionnaires'
import type { FicheQuestionnaire } from '../types/questionnaires'
import { utiliserUtilisateur } from './utiliser-utilisateur'

// Fiche complete du questionnaire selectionne (ecran E10, jour 19) : questions de la derniere version,
// points de contact, dates. Elle alimente le panneau de detail et l'histogramme des types de questions.
// - id null (aucune selection) : aucun appel, rien n'est charge.
// - quand l'id change, la fiche precedente n'est plus donnee : le panneau repasse en chargement.
// - une reponse qui arrive trop tard (selection changee entre-temps) est ignoree.
// Une session expiree (401) renvoie a la page de connexion.
// recharger() relance le chargement apres une erreur (bouton "Reessayer").

export type ResultatFicheQuestionnaire = {
  // Fiche du questionnaire selectionne ; null tant qu'elle n'est pas chargee (ou en cas d'erreur).
  fiche: FicheQuestionnaire | null
  // Vrai tant que la fiche du questionnaire selectionne n'est pas arrivee.
  chargement: boolean
  // Erreur du chargement (null = tout va bien). Statut 404 : le questionnaire n'existe plus.
  erreur: ErreurService | null
  recharger: () => void
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

export function utiliserFicheQuestionnaire(id: string | null): ResultatFicheQuestionnaire {
  const { seDeconnecter } = utiliserUtilisateur()

  const [dernier, setDernier] = useState<Chargement | null>(null)
  // Augmente a chaque clic sur "Reessayer"
  const [relance, setRelance] = useState(0)

  useEffect(() => {
    if (id === null) {
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
  }, [id, relance, seDeconnecter])

  const recharger = useCallback(() => {
    // On efface le dernier resultat : le panneau repasse en chargement
    setDernier(null)
    setRelance((valeur) => valeur + 1)
  }, [])

  // Seul le resultat du questionnaire actuellement selectionne compte
  const courant = id !== null && dernier !== null && dernier.id === id ? dernier : null

  return {
    fiche: courant !== null ? courant.fiche : null,
    chargement: id !== null && courant === null,
    erreur: courant !== null ? courant.erreur : null,
    recharger,
  }
}