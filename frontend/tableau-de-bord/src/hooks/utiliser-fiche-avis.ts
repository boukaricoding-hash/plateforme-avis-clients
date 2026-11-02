import { useCallback, useEffect, useState } from 'react'
import { ErreurService } from '../services/api'
import { ajouterNoteAvis, changerStatutAvis, lireFicheAvis } from '../services/avis'
import type { FicheAvis } from '../types/avis'
import type { StatutTraitement } from '../types/tableau-de-bord'
import { utiliserUtilisateur } from './utiliser-utilisateur'

// Toutes les donnees de l'ecran E9 (fiche d'un avis, jour 15), au meme endroit :
// - le chargement de la fiche ;
// - le changement de statut (avec un commentaire facultatif) ;
// - l'ajout d'une note interne.
// Apres un changement reussi, la fiche affichee est mise a jour avec la reponse de l'API
// (nouveau statut, nouvelle ligne en tete de l'historique) : pas de rechargement complet.
// Ce hook suppose que l'ecran est recree quand l'identifiant change (cle sur l'identifiant) :
// il ne remet pas son etat a zero de lui-meme.

export type ResultatFicheAvis = {
  fiche: FicheAvis | null
  // Vrai tant qu'on attend la toute premiere reponse.
  chargementInitial: boolean
  chargementEnCours: boolean
  // Erreur de chargement de la fiche.
  erreur: ErreurService | null
  // L'avis n'existe pas, est d'une autre organisation, hors du perimetre, ou l'identifiant est invalide.
  introuvable: boolean
  recharger: () => void

  // Renvoie true si le statut a ete change (l'ecran peut alors vider son champ de commentaire).
  changerStatut: (statut: StatutTraitement, commentaire: string) => Promise<boolean>
  statutEnCours: boolean
  erreurStatut: ErreurService | null

  // Renvoie true si la note a ete ajoutee.
  ajouterNote: (commentaire: string) => Promise<boolean>
  noteEnCours: boolean
  erreurNote: ErreurService | null
}

function versErreurService(erreur: unknown): ErreurService {
  if (erreur instanceof ErreurService) {
    return erreur
  }
  return new ErreurService(0, 'ERREUR_INCONNUE', 'Une erreur est survenue.', null)
}

// Codes de l'API quand le statut ne peut pas etre change : deja ce statut, ou quelqu'un
// vient de le changer. Dans les deux cas, la fiche affichee n'est plus a jour.
const CODES_STATUT_PERIME = ['STATUT_INCHANGE', 'CONFLIT_STATUT']

export function utiliserFicheAvis(id: string): ResultatFicheAvis {
  const { seDeconnecter } = utiliserUtilisateur()

  const [fiche, setFiche] = useState<FicheAvis | null>(null)
  const [enCours, setEnCours] = useState(true)
  const [erreur, setErreur] = useState<ErreurService | null>(null)
  // Augmente a chaque clic sur "Reessayer" pour relancer le chargement.
  const [relance, setRelance] = useState(0)

  const [statutEnCours, setStatutEnCours] = useState(false)
  const [erreurStatut, setErreurStatut] = useState<ErreurService | null>(null)
  const [noteEnCours, setNoteEnCours] = useState(false)
  const [erreurNote, setErreurNote] = useState<ErreurService | null>(null)

  const recharger = useCallback(() => {
    setRelance((valeur) => valeur + 1)
  }, [])

  // --- Chargement de la fiche ------------------------------------------------

  useEffect(() => {
    let annule = false

    async function charger(): Promise<void> {
      setEnCours(true)
      try {
        const resultat = await lireFicheAvis(id)
        if (annule) {
          return
        }
        setFiche(resultat)
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
        setFiche(null)
        setErreur(erreurService)
      } finally {
        if (!annule) {
          setEnCours(false)
        }
      }
    }

    void charger()

    return () => {
      annule = true
    }
  }, [id, relance, seDeconnecter])

  // --- Changer le statut -----------------------------------------------------

  const changerStatut = useCallback(
    async (statut: StatutTraitement, commentaire: string): Promise<boolean> => {
      const texte = commentaire.trim()
      setStatutEnCours(true)
      setErreurStatut(null)
      try {
        const resultat = await changerStatutAvis(id, {
          statut,
          commentaire: texte === '' ? undefined : texte,
        })
        setFiche((avant) =>
          avant === null
            ? avant
            : {
                ...avant,
                statut_traitement: resultat.statut_traitement,
                suivis: [resultat.suivi, ...avant.suivis],
              },
        )
        return true
      } catch (e) {
        const erreurService = versErreurService(e)
        if (erreurService.statut === 401) {
          void seDeconnecter()
          return false
        }
        setErreurStatut(erreurService)
        if (CODES_STATUT_PERIME.includes(erreurService.code)) {
          // On remet la fiche a jour : le statut et l'historique affiches doivent etre les vrais.
          try {
            setFiche(await lireFicheAvis(id))
          } catch {
            // Si ce rechargement echoue aussi, l'erreur du statut reste affichee.
          }
        }
        return false
      } finally {
        setStatutEnCours(false)
      }
    },
    [id, seDeconnecter],
  )

  // --- Ajouter une note interne ----------------------------------------------

  const ajouterNote = useCallback(
    async (commentaire: string): Promise<boolean> => {
      setNoteEnCours(true)
      setErreurNote(null)
      try {
        const suivi = await ajouterNoteAvis(id, commentaire.trim())
        setFiche((avant) =>
          avant === null ? avant : { ...avant, suivis: [suivi, ...avant.suivis] },
        )
        return true
      } catch (e) {
        const erreurService = versErreurService(e)
        if (erreurService.statut === 401) {
          void seDeconnecter()
          return false
        }
        setErreurNote(erreurService)
        return false
      } finally {
        setNoteEnCours(false)
      }
    },
    [id, seDeconnecter],
  )

  return {
    fiche,
    chargementInitial: fiche === null && erreur === null,
    chargementEnCours: enCours,
    erreur,
    introuvable: erreur !== null && (erreur.statut === 404 || erreur.statut === 400),
    recharger,
    changerStatut,
    statutEnCours,
    erreurStatut,
    ajouterNote,
    noteEnCours,
    erreurNote,
  }
}