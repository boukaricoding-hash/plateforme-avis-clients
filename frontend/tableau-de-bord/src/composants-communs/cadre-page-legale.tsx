import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { utiliserLangue } from '../hooks/utiliser-langue'
import type { Langue } from '../types/langue'
import '../styles/connexion.css'
import { BoutonTheme } from './bouton-theme'
import { PiedDePageConfiance } from './pied-de-page-confiance'

type Proprietes = {
  titre: string
  children: ReactNode
}

const NOM_ENTREPRISE = 'Data Trace Service'
// Version allegee du logo (256 px), dans frontend/tableau-de-bord/public/
const URL_LOGO = `${import.meta.env.BASE_URL}data-logo.webp`

// Fleche du lien "Retour a la connexion"
const ICONE_RETOUR = 'M19 12H5M11 6l-6 6 6 6'

// Presentation commune des pages publiques de texte (mentions legales, confidentialite).
// Contrairement a l'ecran de connexion, la page defile : le texte peut etre long.
// Les styles sont dans styles/connexion.css (classes "page-legale").
export function CadrePageLegale({ titre, children }: Proprietes) {
  const { t, langue, changerLangue } = utiliserLangue()
  // Si le logo est absent, on le cache au lieu d'afficher une icone cassee.
  const [logoDisponible, setLogoDisponible] = useState(true)

  function boutonLangue(code: Langue, libelle: string, nom: string) {
    const actif = langue === code
    return (
      <button
        type="button"
        onClick={() => changerLangue(code)}
        aria-pressed={actif}
        aria-label={nom}
        className={`min-h-11 min-w-11 border px-2 text-sm font-semibold transition-colors ${
          actif
            ? 'border-(--couleur-principale) text-(--couleur-principale)'
            : 'border-transparent text-texte-secondaire hover:text-texte'
        }`}
      >
        {libelle}
      </button>
    )
  }

  return (
    <div className="page-legale">
      <header className="page-legale-barre">
        <Link to="/connexion" className="page-legale-marque">
          {logoDisponible && (
            <img
              src={URL_LOGO}
              alt=""
              width="40"
              height="40"
              onError={() => setLogoDisponible(false)}
              className="h-10 w-10 shrink-0 object-contain"
            />
          )}
          <span>{NOM_ENTREPRISE}</span>
        </Link>

        <div className="page-legale-outils">
          <BoutonTheme />
          <div className="flex items-center gap-1" role="group" aria-label={t('commun.langue')}>
            {boutonLangue('fr', 'FR', t('commun.francais'))}
            {boutonLangue('en', 'EN', t('commun.anglais'))}
          </div>
        </div>
      </header>

      <main className="page-legale-corps">
        <Link to="/connexion" className="page-legale-retour">
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d={ICONE_RETOUR} />
          </svg>
          {t('commun.retourConnexion')}
        </Link>

        <h1 className="page-legale-titre">{titre}</h1>
        <div className="page-legale-texte">{children}</div>
      </main>

      <PiedDePageConfiance nom={NOM_ENTREPRISE} />
    </div>
  )
}