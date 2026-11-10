import { useCallback, useEffect, useState } from 'react'
import { ErreurService } from '../services/api'
import { listerVersions } from '../services/questionnaires'
import type { VersionHistorique } from '../types/questionnaires'
import { utiliserUtilisateur } from './utiliser-utilisateur'

// Historique des versions d'un questionnaire (editeur E10, jour 20) : de la plus recente a la plus
// ancienne, avec pour chaque version son numero, sa date de publication, son nombre de questions
// et le nombre d'avis recus. Il alimente la section "Versions" sous le formulaire.
// - id null (questionnaire pas encore cree) : aucun appel, rien n'est charge.
// - jeton : un texte que la page change quand l'historique a pu changer (par exemple le numero et
//   la date de publication de la derniere version, lus dans la fiche). Chaque changement relit
//   l'historique, sans que la page ait a appeler recharger() elle-meme.
// - pendant une relecture, l'ancien historique reste affiche.
// - une reponse qui arrive trop tard (questionnaire change entre-temps) est ignoree.
// Seul le Responsable lit l'historique (le serveur repond 403 aux autres : aucun appel dans ce cas).
// Une session expiree (401) renvoie a la page de connexion.
// recharger() relance le chargement apres une erreur (bouton "Reessayer").

export type ResultatVersionsQuestionnaire = {
  // Versions, de la plus recente a la plus ancienne ; null tant qu'elles ne sont pas chargees.
  versions: VersionHistorique[] | null
  // Vrai tant que l'historique du questionnaire n'est pas arrive.
  chargement: boolean
  // Erreur du chargement (null = tout va bien). Statut 404 : le questionnaire n'existe plus.
  erreur: ErreurService | null
  recharger: () => void
}

// Resultat du dernier chargement, avec l'id demande : sert a ne jamais montrer l'historique d'un autre questionnaire
type Chargement = {
  id: string
  versions: VersionHistorique[] | null
  erreur: ErreurService | null
}

function versErreurService(erreur: unknown): ErreurService {
  if (erreur instanceof ErreurService) {
    return erreur
  }
  return new ErreurService(0, 'ERREUR_INCONNUE', 'Une erreur est survenue.', null)
}

export function utiliserVersionsQuestionnaire(
  id: string | null,
  jeton: string,
): ResultatVersionsQuestionnaire {
  const { utilisateur, seDeconnecter } = utiliserUtilisateur()

  const actif = id !== null && utilisateur?.role === 'RESPONSABLE'

  const [dernier, setDernier] = useState<Chargement | null>(null)
  // Augmente a chaque clic sur "Reessayer"
  const [relance, setRelance] = useState(0)

  useEffect(() => {
    if (id === null || utilisateur?.role !== 'RESPONSABLE') {
      return
    }

    let annule = false

    async function charger(idDemande: string): Promise<void> {
      try {
        const versions = await listerVersions(idDemande)
        if (annule) {
          return
        }
        setDernier({ id: idDemande, versions, erreur: null })
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
        // Un echec de relecture garde l'ancien historique du meme questionnaire.
        setDernier((avant) => ({
          id: idDemande,
          versions: avant !== null && avant.id === idDemande ? avant.versions : null,
          erreur: erreurService,
        }))
      }
    }

    void charger(id)

    return () => {
      annule = true
    }
  }, [id, utilisateur?.role, jeton, relance, seDeconnecter])

  const recharger = useCallback(() => {
    // Une erreur est effacee : la section repasse en chargement
    setDernier((avant) => (avant !== null && avant.erreur !== null ? null : avant))
    setRelance((valeur) => valeur + 1)
  }, [])

  // Seul le resultat du questionnaire actuellement affiche compte
  const courant = actif && dernier !== null && dernier.id === id ? dernier : null

  return {
    versions: courant !== null ? courant.versions : null,
    chargement: actif && courant === null,
    erreur: courant !== null ? courant.erreur : null,
    recharger,
  }
}