import { useState } from 'react'
import type { ReactNode } from 'react'
import { utiliserLangue } from '../hooks/utiliser-langue'
import type { Langue } from '../types/langue'
import { BoutonTheme } from './bouton-theme'

type Proprietes = {
  titre: string
  sousTitre?: string
  children: ReactNode
}

const NOM_ENTREPRISE = 'Data Trace Africa'
// Le fichier se trouve dans frontend/tableau-de-bord/public/data.png
const URL_LOGO = `${import.meta.env.BASE_URL}data.png`

// Presentation commune des ecrans accessibles sans etre connecte.
// Le contenu est pose directement sur le fond de la page : ni carte, ni bordure, ni ombre.
export function CadreAuthentification({ titre, sousTitre, children }: Proprietes) {
  const { t, langue, changerLangue } = utiliserLangue()
  // Si data.png est absent, on cache l'image au lieu d'afficher une icone cassee.
  const [logoDisponible, setLogoDisponible] = useState(true)

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
    // Page fixe : jamais de defilement. Tout tient dans 90 % de la hauteur de l'ecran
    // et les tailles (logo, espaces) se reduisent avec la hauteur disponible.
    <div className="relative flex h-dvh items-center justify-center overflow-hidden bg-fond px-4">
      {/* Theme et langue : dans le coin en haut a droite de l'ecran, hors de la colonne centrale */}
      <div className="absolute right-3 top-3 z-10 flex items-center gap-1 sm:right-6 sm:top-5">
        <BoutonTheme />
        <div className="flex items-center gap-1" role="group" aria-label={t('commun.langue')}>
          {boutonLangue('fr', 'FR', t('commun.francais'))}
          {boutonLangue('en', 'EN', t('commun.anglais'))}
        </div>
      </div>

      <div className="flex h-[90dvh] w-full max-w-md animate-monte flex-col motion-reduce:animate-none">
        <div className="flex min-h-0 flex-1 flex-col px-2 sm:px-4">
          {/* my-auto : centre le bloc, et s'il est trop haut il deborde vers le bas (jamais vers le haut) */}
          <div className="my-auto">
            <div className="mb-[3vh] flex flex-col items-center text-center">
              {logoDisponible && (
                <img
                  src={URL_LOGO}
                  alt={NOM_ENTREPRISE}
                  onError={() => setLogoDisponible(false)}
                  className="mb-3 h-[clamp(3rem,15vh,9rem)] w-auto max-w-full object-contain"
                />
              )}
              <p className="font-titre text-3xl font-bold tracking-wide text-texte">{NOM_ENTREPRISE}</p>
              <p className="mt-1 text-xs uppercase tracking-widest text-texte-secondaire">
                {t('marque.produit')}
              </p>
            </div>

            <h1 className="font-titre text-xl font-bold text-texte">{titre}</h1>
            {sousTitre !== undefined && (
              <p className="mt-1 text-sm text-texte-secondaire">{sousTitre}</p>
            )}

            <div className="mt-[2.5vh]">{children}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
