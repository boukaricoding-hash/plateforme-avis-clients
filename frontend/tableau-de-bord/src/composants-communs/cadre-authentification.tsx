import { useState } from 'react'
import type { ReactNode } from 'react'
import { utiliserLangue } from '../hooks/utiliser-langue'
import type { Langue } from '../types/langue'
import '../styles/connexion.css'
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
// Ecran large : photo plein ecran, texte a gauche, formulaire a droite. Autres ecrans : formulaire seul.
export function CadreAuthentification({ titre, sousTitre, children }: Proprietes) {
  const { t, langue, changerLangue } = utiliserLangue()
  // Si une image est absente, on la cache au lieu d'afficher une icone cassee.
  const [logoDisponible, setLogoDisponible] = useState(true)
  const [photoDisponible, setPhotoDisponible] = useState(true)

  // Dernier mot en dore : "de s'ameliorer." / "Africa"
  const accroche = t('marque.accroche')
  const coupeAccroche = accroche.lastIndexOf(' ')
  const coupeNom = NOM_ENTREPRISE.lastIndexOf(' ')

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
    <div
      className={`connexion-ecran relative flex h-dvh overflow-hidden bg-fond ${
        photoDisponible ? 'connexion-avec-photo' : ''
      }`}
    >
      {/* Ecran large : connexion.png couvre toute la page (voir styles/connexion.css).
          loading="lazy" : sur un petit ecran l'image est cachee, donc elle n'est pas chargee. */}
      {photoDisponible && (
        <img
          src={URL_PHOTO}
          alt=""
          aria-hidden="true"
          loading="lazy"
          onError={() => setPhotoDisponible(false)}
          className="connexion-fond"
        />
      )}

      {/* Ecran large : le texte de la marque, a gauche sur la partie sombre de la photo */}
      <div className="connexion-gauche">
        <div className="connexion-entete">
          {logo('h-[clamp(2.75rem,7dvh,4rem)]')}
          <div className="connexion-texte-photo">
            <p className="font-titre text-[clamp(1.25rem,1.7vw,1.9rem)] font-bold leading-tight tracking-wide text-white">
              {NOM_ENTREPRISE.slice(0, coupeNom)} <span className="connexion-or">{NOM_ENTREPRISE.slice(coupeNom + 1)}</span>
            </p>
            <p className="mt-1 text-[clamp(0.625rem,0.75vw,0.8125rem)] uppercase tracking-[0.3em] text-white/85">
              {t('marque.produit')}
            </p>
          </div>
        </div>

        <div className="connexion-message connexion-texte-photo">
          <p className="font-titre text-[clamp(1.75rem,2.7vw,3.1rem)] font-bold leading-[1.12] text-white">
            {accroche.slice(0, coupeAccroche)} <span className="connexion-or">{accroche.slice(coupeAccroche + 1)}</span>
          </p>
          <p className="mt-[2.4dvh] text-[clamp(0.875rem,1.05vw,1.0625rem)] leading-relaxed text-white/90">
            {t('marque.accrocheDetail')}
          </p>
        </div>
      </div>

      {/* Panneau formulaire */}
      <div className="connexion-droite relative flex h-dvh flex-1 items-center justify-center px-6">
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
            <div className="connexion-logo-petit mb-[3vh] flex flex-col items-center text-center">
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

        <p className="connexion-copyright absolute bottom-4 left-0 right-0 text-center text-xs text-texte-secondaire">
          © {new Date().getFullYear()} {NOM_ENTREPRISE}
        </p>
      </div>
    </div>
  )
}