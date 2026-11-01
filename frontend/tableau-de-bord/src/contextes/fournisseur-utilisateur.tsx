import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Utilisateur } from '../types/utilisateur'
import { connecter, deconnecter, lireMoi } from '../services/api'
import { ContexteUtilisateur } from './contexte-utilisateur'
import type { ValeurContexteUtilisateur } from './contexte-utilisateur'

type Proprietes = {
  children: ReactNode
}

export function FournisseurUtilisateur({ children }: Proprietes) {
  const [utilisateur, setUtilisateur] = useState<Utilisateur | null>(null)
  const [verification, setVerification] = useState(true)

  // Au demarrage : y a-t-il deja une session valide (cookie) ?
  useEffect(() => {
    let annule = false
    lireMoi()
      .then((courant) => {
        if (!annule) {
          setUtilisateur(courant)
        }
      })
      .catch(() => {
        // 401 (pas connecte) ou pas de reseau : on considere que personne n'est connecte.
        if (!annule) {
          setUtilisateur(null)
        }
      })
      .finally(() => {
        if (!annule) {
          setVerification(false)
        }
      })
    return () => {
      annule = true
    }
  }, [])

  const seConnecter = useCallback(
    async (email: string, motDePasse: string, seSouvenir: boolean) => {
      const connecte = await connecter(email, motDePasse, seSouvenir)
      setUtilisateur(connecte)
    },
    [],
  )

  const seDeconnecter = useCallback(async () => {
    try {
      await deconnecter()
    } catch {
      // Meme si le serveur ne repond pas, l'ecran se deconnecte.
    } finally {
      setUtilisateur(null)
    }
  }, [])

  const valeur = useMemo<ValeurContexteUtilisateur>(
    () => ({ utilisateur, verification, seConnecter, seDeconnecter }),
    [utilisateur, verification, seConnecter, seDeconnecter],
  )

  return <ContexteUtilisateur.Provider value={valeur}>{children}</ContexteUtilisateur.Provider>
}