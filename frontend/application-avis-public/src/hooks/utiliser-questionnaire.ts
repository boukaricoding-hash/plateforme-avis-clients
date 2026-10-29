import { useCallback, useEffect, useState } from 'react'
import { ErreurService, lireQuestionnaire } from '../services/api-public'
import type { QuestionnairePublic } from '../types/avis-public'

// Les 3 etats possibles du chargement du questionnaire.
export type EtatQuestionnaire =
  | { statut: 'chargement' }
  | { statut: 'erreur'; erreur: ErreurService }
  | { statut: 'pret'; donnees: QuestionnairePublic }

type EtatAvecCode = { code: string | undefined } & EtatQuestionnaire

// Un appel par code : lireQuestionnaire enregistre un scan a chaque appel,
// il ne faut donc pas le repeter (double effet de React en dev, retour a l'accueil).
// En cas d'erreur, on oublie la requete pour pouvoir reessayer.
const chargements = new Map<string, Promise<QuestionnairePublic>>()

function charger(code: string): Promise<QuestionnairePublic> {
  const existant = chargements.get(code)
  if (existant !== undefined) {
    return existant
  }
  const promesse = lireQuestionnaire(code)
  chargements.set(code, promesse)
  promesse.catch(() => {
    chargements.delete(code)
  })
  return promesse
}

function versErreurService(erreur: unknown): ErreurService {
  if (erreur instanceof ErreurService) {
    return erreur
  }
  return new ErreurService(0, 'ERREUR_INCONNUE', 'Une erreur est survenue.', null)
}

// Charge le questionnaire d'un QR code : chargement, erreur ou donnees.
// recharger() relance le chargement (bouton "Reessayer").
export function utiliserQuestionnaire(code: string | undefined): {
  etat: EtatQuestionnaire
  recharger: () => void
} {
  const [etat, setEtat] = useState<EtatAvecCode>({ code, statut: 'chargement' })
  const [tentative, setTentative] = useState(0)

  useEffect(() => {
    if (code === undefined) {
      return undefined
    }
    let annule = false
    charger(code)
      .then((donnees) => {
        if (!annule) {
          setEtat({ code, statut: 'pret', donnees })
        }
      })
      .catch((erreur: unknown) => {
        if (!annule) {
          setEtat({ code, statut: 'erreur', erreur: versErreurService(erreur) })
        }
      })
    return () => {
      annule = true
    }
  }, [code, tentative])

  const recharger = useCallback(() => {
    setEtat({ code, statut: 'chargement' })
    setTentative((n) => n + 1)
  }, [code])

  let courant: EtatQuestionnaire
  if (code === undefined) {
    courant = {
      statut: 'erreur',
      erreur: new ErreurService(404, 'QR_INCONNU', 'Code absent.', null),
    }
  } else if (etat.code !== code) {
    // Le code a change : on repart de zero.
    courant = { statut: 'chargement' }
  } else {
    courant = etat
  }

  return { etat: courant, recharger }
}