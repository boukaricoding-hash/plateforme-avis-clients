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
// Les deux images se trouvent dans frontend/tableau-de-bord/public/
const URL_LOGO = `${import.meta.env.BASE_URL}data.png`
const URL_PHOTO = `${import.meta.env.BASE_URL}connexion.png`

// Presentation commune des ecrans accessibles sans etre connecte.
// Grand ecran : photo a gauche, formulaire a droite. Petit ecran : formulaire seul.
export function CadreAuthentification({ titre, sousTitre, children }: Proprietes) {
  const { t, langue, changerLangue } = utiliserLangue()
  // Si une image est absente, on la cache au lieu d'afficher une icone cassee.
  const [logoDisponible, setLogoDisponible] = useState(true)
  const [photoDisponible, setPhotoDisponible] = useState(true)

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

  function logo(classes: string) {
    if (!logoDisponible) {
      return null
    }
    return (
      <img
        src={URL_LOGO}
        alt={NOM_ENTREPRISE}
        onError={() => setLogoDisponible(false)}
        className={`w-auto object-contain ${classes}`}
      />
    )
  }

  return (
    // Page fixe : jamais de defilement. Tout tient dans 90 % de la hauteur de l'ecran
    // et les tailles (logo, espaces) se reduisent avec la hauteur disponible.
    <div className="relative flex h-dvh overflow-hidden bg-fond">
      {/* Panneau photo : a partir de 1024 px de large. Le degrade sert de fond si la photo est absente. */}
      <div className="relative hidden w-[55%] overflow-hidden bg-linear-to-br from-[#7a5f36] via-[#4a3a22] to-[#211a10] lg:block">
        {photoDisponible && (
          <img
            src={URL_PHOTO}
            alt=""
            aria-hidden="true"
            onError={() => setPhotoDisponible(false)}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        {/* Voile sombre : garde le texte lisible, quelle que soit la photo */}
        <div className="absolute inset-0 bg-linear-to-b from-black/35 via-black/10 to-black/80" />

        <div className="absolute left-14 top-12 flex items-center gap-3.5">
          {logo('h-[clamp(2.5rem,7vh,3.5rem)]')}
          <div>
            <p className="font-titre text-2xl font-bold tracking-wide text-white">{NOM_ENTREPRISE}</p>
            <p className="mt-0.5 text-[11px] uppercase tracking-[0.18em] text-white/80">
              {t('marque.produit')}
            </p>
          </div>
        </div>

        <div className="absolute bottom-14 left-14 right-14 max-w-xl">
          <p className="font-titre text-4xl font-bold leading-tight text-white">{t('marque.accroche')}</p>
          <p className="mt-3 text-base leading-relaxed text-white/85">{t('marque.accrocheDetail')}</p>
        </div>
      </div>

      {/* Panneau formulaire */}
      <div className="relative flex h-dvh flex-1 items-center justify-center px-6">
        {/* Theme et langue : dans le coin en haut a droite de l'ecran */}
        <div className="absolute right-3 top-3 z-10 flex items-center gap-1 sm:right-6 sm:top-5">
          <BoutonTheme />
          <div className="flex items-center gap-1" role="group" aria-label={t('commun.langue')}>
            {boutonLangue('fr', 'FR', t('commun.francais'))}
            {boutonLangue('en', 'EN', t('commun.anglais'))}
          </div>
        </div>

        <div className="flex h-[90dvh] w-full max-w-sm animate-monte flex-col motion-reduce:animate-none">
          {/* my-auto : centre le bloc, et s'il est trop haut il deborde vers le bas (jamais vers le haut) */}
          <div className="my-auto">
            {/* Petit ecran : pas de photo, donc le logo et le nom passent au-dessus du formulaire */}
            <div className="mb-[3vh] flex flex-col items-center text-center lg:hidden">
              {logo('mb-3 h-[clamp(3rem,13vh,7rem)] max-w-full')}
              <p className="font-titre text-3xl font-bold tracking-wide text-texte">{NOM_ENTREPRISE}</p>
              <p className="mt-1 text-xs uppercase tracking-widest text-texte-secondaire">
                {t('marque.produit')}
              </p>
            </div>

            <h1 className="font-titre text-3xl font-bold text-texte">{titre}</h1>
            {sousTitre !== undefined && (
              <p className="mt-1.5 text-[15px] text-texte-secondaire">{sousTitre}</p>
            )}

            <div className="mt-[4vh]">{children}</div>
          </div>
        </div>

        <p className="absolute bottom-4 left-0 right-0 text-center text-xs text-texte-secondaire">
          © {new Date().getFullYear()} {NOM_ENTREPRISE}
        </p>
      </div>
    </div>
  )
}
