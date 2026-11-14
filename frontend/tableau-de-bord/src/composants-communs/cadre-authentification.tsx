import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router'
import { utiliserLangue } from '../hooks/utiliser-langue'
import type { Langue } from '../types/langue'
import '../styles/connexion.css'
import { BoutonTheme } from './bouton-theme'
import { CarrouselConnexion } from './carrousel-connexion'

type Proprietes = {
  titre: string
  sousTitre?: string
  children: ReactNode
}

const NOM_ENTREPRISE = 'Data Trace Africa'
// Les deux images se trouvent dans frontend/tableau-de-bord/public/
const URL_LOGO = `${import.meta.env.BASE_URL}data.png`
const URL_PHOTO = `${import.meta.env.BASE_URL}connexion.png`

// Presentation commune des ecrans accessibles sans etre connecte (styles/connexion.css).
// Ecran large : le message qui defile a gauche, a droite l'image ou le formulaire.
// Sur l'ecran de connexion, l'image est montree en premier et le bouton "Espace client"
// la remplace par le formulaire. Les autres ecrans montrent le formulaire tout de suite.
// Petit ecran : le formulaire seul, avec le logo en haut.
export function CadreAuthentification({ titre, sousTitre, children }: Proprietes) {
  const { t, langue, changerLangue } = utiliserLangue()
  const emplacement = useLocation()
  const refFormulaire = useRef<HTMLDivElement>(null)

  // Seul l'ecran de connexion montre l'image avant le formulaire.
  const vitrine = emplacement.pathname === '/connexion'
  const [ouvert, setOuvert] = useState(!vitrine)
  // Si une image est absente, on la cache au lieu d'afficher une icone cassee.
  const [logoDisponible, setLogoDisponible] = useState(true)
  const [photoDisponible, setPhotoDisponible] = useState(true)

  // L'image n'existe que sur l'ecran de connexion. Sans elle, le formulaire est toujours ouvert.
  const aUneImage = vitrine && photoDisponible
  const formulaireOuvert = ouvert || !aUneImage

  // Quand le formulaire remplace l'image, le curseur va dans le premier champ.
  useEffect(() => {
    if (vitrine && ouvert) {
      refFormulaire.current?.querySelector('input')?.focus()
    }
  }, [vitrine, ouvert])

  // Dernier mot en couleur d'accent : "Africa"
  const coupeNom = NOM_ENTREPRISE.lastIndexOf(' ')

  function boutonLangue(code: Langue, libelle: string, nom: string) {
    const actif = langue === code
    // Le rayon de 5 px vient de connexion.css. Langue active : trait d'accent, pas de fond.
    return (
      <button
        type="button"
        onClick={() => changerLangue(code)}
        aria-pressed={actif}
        aria-label={nom}
        className={`min-h-11 min-w-11 border px-2 text-sm font-semibold transition-colors ${
          actif
            ? 'border-(--connexion-accent) text-(--connexion-accent)'
            : 'border-transparent text-texte-secondaire hover:text-texte'
        }`}
      >
        {libelle}
      </button>
    )
  }

  return (
    <div className="connexion-ecran" data-formulaire={formulaireOuvert ? 'ouvert' : 'ferme'}>
      {/* Barre du haut : logo et nom a gauche, theme, langue et "Espace client" a droite */}
      <header className="connexion-barre">
        <div className="connexion-marque min-w-0">
          {logoDisponible && (
            <img
              src={URL_LOGO}
              alt=""
              onError={() => setLogoDisponible(false)}
              className="h-[clamp(2.25rem,5dvh,3.25rem)] w-auto shrink-0 object-contain"
            />
          )}
          <p className="connexion-marque-nom min-w-0">
            {NOM_ENTREPRISE.slice(0, coupeNom)} <span>{NOM_ENTREPRISE.slice(coupeNom + 1)}</span>
          </p>
        </div>

        <div className="connexion-outils">
          <BoutonTheme />
          <div className="flex items-center gap-1" role="group" aria-label={t('commun.langue')}>
            {boutonLangue('fr', 'FR', t('commun.francais'))}
            {boutonLangue('en', 'EN', t('commun.anglais'))}
          </div>
          {aUneImage && (
            <button type="button" className="connexion-bouton-espace" onClick={() => setOuvert(true)}>
              {t('connexion.espaceClient')}
            </button>
          )}
        </div>
      </header>

      <div className="connexion-corps">
        {/* Ecran large : les trois messages qui defilent */}
        <section className="connexion-gauche">
          <CarrouselConnexion />
        </section>

        <div className="connexion-droite">
          {/* Ecran large : l'image, remplacee par le formulaire apres un clic sur "Espace client" */}
          {aUneImage && (
            <div className="connexion-image-zone">
              <img
                src={URL_PHOTO}
                alt=""
                aria-hidden="true"
                onError={() => setPhotoDisponible(false)}
                className="connexion-image"
              />
            </div>
          )}

          <div
            ref={refFormulaire}
            className="connexion-formulaire animate-monte motion-reduce:animate-none"
          >
            <h1 className="text-3xl font-bold text-texte">{titre}</h1>
            {sousTitre !== undefined && (
              <p className="mt-1.5 text-[15px] text-texte-secondaire">{sousTitre}</p>
            )}

            <div className="mt-[4vh]">{children}</div>

            {aUneImage && (
              <button type="button" className="connexion-retour" onClick={() => setOuvert(false)}>
                {t('connexion.retour')}
              </button>
            )}
          </div>
        </div>
      </div>

      <p className="connexion-copyright">
        © {new Date().getFullYear()} {NOM_ENTREPRISE}
      </p>
    </div>
  )
}