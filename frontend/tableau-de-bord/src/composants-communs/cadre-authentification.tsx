import type { ReactNode } from 'react'
import { utiliserLangue } from '../hooks/utiliser-langue'
import type { Langue } from '../types/langue'
import { BoutonTheme } from './bouton-theme'

type Proprietes = {
  titre: string
  sousTitre?: string
  children: ReactNode
}

// Presentation commune des ecrans accessibles sans etre connecte.
export function CadreAuthentification({ titre, sousTitre, children }: Proprietes) {
  const { t, langue, changerLangue } = utiliserLangue()

  function boutonLangue(code: Langue, libelle: string, nom: string) {
    const actif = langue === code
    return (
      <button
        type="button"
        onClick={() => changerLangue(code)}
        aria-pressed={actif}
        aria-label={nom}
        className={`min-h-11 min-w-11 rounded-md px-2 text-sm font-semibold transition-colors ${
          actif
            ? 'bg-principale text-texte-sur-principale'
            : 'text-texte-secondaire hover:bg-surface-douce'
        }`}
      >
        {libelle}
      </button>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-fond px-4 py-8">
      <div className="mb-4 flex w-full max-w-md items-center justify-end gap-1">
        <BoutonTheme />
        <div className="flex items-center gap-1" role="group" aria-label={t('commun.langue')}>
          {boutonLangue('fr', 'FR', t('commun.francais'))}
          {boutonLangue('en', 'EN', t('commun.anglais'))}
        </div>
      </div>

      <div className="w-full max-w-md animate-monte rounded-xl border border-bordure bg-surface p-6 shadow-moyen motion-reduce:animate-none sm:p-8">
        <div className="mb-6 text-center">
          <p className="font-titre text-2xl font-bold text-texte">{t('marque.produit')}</p>
          <p className="text-xs text-texte-secondaire">{t('marque.fournisseur')}</p>
        </div>

        <h1 className="font-titre text-xl font-bold text-texte">{titre}</h1>
        {sousTitre !== undefined && (
          <p className="mt-1 text-sm text-texte-secondaire">{sousTitre}</p>
        )}

        <div className="mt-6">{children}</div>
      </div>
    </div>
  )
}