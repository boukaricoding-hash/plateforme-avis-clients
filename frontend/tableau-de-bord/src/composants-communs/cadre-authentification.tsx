import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router'
import { utiliserLangue } from '../hooks/utiliser-langue'
import type { Langue } from '../types/langue'
import '../styles/connexion.css'
import { AccueilTelephone } from './accueil-telephone'
import { BasDePageConnexion } from './bas-de-page-connexion'
import { BoutonContact } from './bouton-contact'
import { BoutonTheme } from './bouton-theme'
import { CarrouselConnexion } from './carrousel-connexion'
import { PiedDePageConfiance } from './pied-de-page-confiance'
import { SceneTelephone } from './scene-telephone'

type Proprietes = {
  titre: string
  sousTitre?: string
  children: ReactNode
}

const NOM_ENTREPRISE = 'Data Trace Africa'
// Version allegee du logo (256 px), dans frontend/tableau-de-bord/public/
const URL_LOGO = `${import.meta.env.BASE_URL}data-logo.webp`

// Presentation commune des ecrans accessibles sans etre connecte (styles/connexion.css).
// Ecran large : le message qui defile a gauche, a droite la scene animee ou le formulaire.
// Sur l'ecran de connexion, la scene (telephone, QR code, orbite) est montree en premier :
// le bouton "Espace client" ou "Acceder a mon espace" la remplace par le formulaire.
// Les autres ecrans montrent le formulaire tout de suite.
// Petit ecran : sur l'ecran de connexion, un accueil court (accueil-telephone.tsx) avec le
// bouton "Acceder a mon espace", qui ouvre le formulaire ; les autres ecrans montrent le
// formulaire seul. Le pied de page (mentions legales, confidentialite, contact) est partout.
export function CadreAuthentification({ titre, sousTitre, children }: Proprietes) {
  const { t, langue, changerLangue } = utiliserLangue()
  const emplacement = useLocation()
  const refFormulaire = useRef<HTMLDivElement>(null)

  // Seul l'ecran de connexion montre la scene avant le formulaire.
  const vitrine = emplacement.pathname === '/connexion'
  const [ouvert, setOuvert] = useState(!vitrine)
  // Si le logo est absent, on le cache au lieu d'afficher une icone cassee.
  const [logoDisponible, setLogoDisponible] = useState(true)

  // Quand le formulaire remplace la scene, le curseur va dans le premier champ.
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
    <div className="connexion-ecran" data-formulaire={ouvert ? 'ouvert' : 'ferme'}>
      {/* Barre du haut : logo et nom a gauche, theme, langue et "Espace client" a droite */}
      <header className="connexion-barre">
        <div className="connexion-marque min-w-0">
          {logoDisponible && (
            <img
              src={URL_LOGO}
              alt=""
              width={256}
              height={256}
              decoding="async"
              onError={() => setLogoDisponible(false)}
              className="h-[clamp(2.25rem,5dvh,3.25rem)] w-auto shrink-0 object-contain"
            />
          )}
          <p className="connexion-marque-nom min-w-0">
            {NOM_ENTREPRISE.slice(0, coupeNom)} <span>{NOM_ENTREPRISE.slice(coupeNom + 1)}</span>
          </p>
        </div>

        <div className="connexion-outils">
          {/* Ecran large : "Demander une demo" pour les personnes qui ne sont pas encore clientes */}
          {vitrine && <BoutonContact emplacement="barre" />}
          <BoutonTheme />
          <div className="flex items-center gap-1" role="group" aria-label={t('commun.langue')}>
            {boutonLangue('fr', 'FR', t('commun.francais'))}
            {boutonLangue('en', 'EN', t('commun.anglais'))}
          </div>
          {vitrine && (
            <button type="button" className="connexion-bouton-espace" onClick={() => setOuvert(true)}>
              {t('connexion.espaceClient')}
            </button>
          )}
        </div>
      </header>

      <div className="connexion-corps">
        {/* Petit ecran : l'accueil court, remplace par le formulaire apres un clic sur le bouton d'acces */}
        {vitrine && !ouvert && (
          <AccueilTelephone
            surAcces={() => setOuvert(true)}
            contact={<BoutonContact emplacement="accueil" />}
          />
        )}

        {/* Ecran large : les trois messages qui defilent, avec le bouton d'acces sur la connexion */}
        <section className="connexion-gauche">
          <CarrouselConnexion surAcces={vitrine ? () => setOuvert(true) : undefined} />
        </section>

        <div className="connexion-droite">
          {/* Ecran large : la scene animee, remplacee par le formulaire apres un clic sur "Espace client" */}
          {vitrine && (
            <div className="connexion-scene-zone">
              <SceneTelephone />
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

            {vitrine && (
              <button type="button" className="connexion-retour" onClick={() => setOuvert(false)}>
                {t('connexion.retour')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Ecran large, scene visible : les secteurs et les garanties */}
      {vitrine && <BasDePageConnexion />}

      <PiedDePageConfiance nom={NOM_ENTREPRISE} />
    </div>
  )
}