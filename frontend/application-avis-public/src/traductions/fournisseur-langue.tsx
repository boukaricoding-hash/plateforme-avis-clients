import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Langue } from '../types/avis-public'
import { fr } from './fr/textes'
import { en } from './en/textes'
import { ContexteLangue } from './contexte-langue'
import type { ValeurContexteLangue, ValeursTexte } from './contexte-langue'

const TEXTES = { fr, en }

// Langue du telephone : anglais si le navigateur est en anglais, sinon francais.
function langueDuNavigateur(): Langue {
  const langue = typeof navigator !== 'undefined' ? navigator.language : 'fr'
  return langue.toLowerCase().startsWith('en') ? 'en' : 'fr'
}

// Cherche un texte avec une cle comme 'question.progression'.
function trouverTexte(source: unknown, cle: string): string | null {
  let courant: unknown = source
  for (const partie of cle.split('.')) {
    if (courant === null || typeof courant !== 'object') {
      return null
    }
    courant = (courant as Record<string, unknown>)[partie]
  }
  return typeof courant === 'string' ? courant : null
}

// Remplace {courant}, {total}, {note}... par les valeurs donnees.
// Un nom inconnu reste tel quel dans le texte.
function remplacer(texte: string, valeurs?: ValeursTexte): string {
  if (!valeurs) {
    return texte
  }
  return texte.replace(/\{(\w+)\}/g, (morceau, nom: string) => {
    const valeur = valeurs[nom]
    return valeur === undefined ? morceau : String(valeur)
  })
}

type Proprietes = {
  children: ReactNode
  // Langue de depart (sinon : celle du navigateur).
  langueInitiale?: Langue
}

export function FournisseurLangue({ children, langueInitiale }: Proprietes) {
  const [langue, setLangue] = useState<Langue>(langueInitiale ?? langueDuNavigateur())

  // La langue de la page change aussi pour les lecteurs d'ecran.
  useEffect(() => {
    document.documentElement.lang = langue
  }, [langue])

  const changerLangue = useCallback((nouvelle: Langue) => {
    setLangue(nouvelle)
  }, [])

  // Texte dans la langue choisie, sinon en francais, sinon la cle elle-meme.
  const t = useCallback(
    (cle: string, valeurs?: ValeursTexte): string => {
      const texte = trouverTexte(TEXTES[langue], cle) ?? trouverTexte(TEXTES.fr, cle) ?? cle
      return remplacer(texte, valeurs)
    },
    [langue],
  )

  const valeur = useMemo<ValeurContexteLangue>(
    () => ({ langue, changerLangue, t }),
    [langue, changerLangue, t],
  )

  return <ContexteLangue.Provider value={valeur}>{children}</ContexteLangue.Provider>
}