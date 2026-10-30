import type { ReactNode } from 'react'
import { EnteteQuestionnaire } from '../../composants/entete-questionnaire'
import { SelecteurLangue } from '../../composants/selecteur-langue'
import { utiliserLangue } from '../../hooks/utiliser-langue'
import type { QuestionnairePublic } from '../../types/avis-public'
import { choisirTexte } from '../../utilitaires/textes-multilingues'

type Proprietes = {
  donnees: QuestionnairePublic
  // Appelee quand le client touche le bouton Commencer.
  commencer: () => void
  // Faux tant que l'ecran d'ouverture est la : les elements restent caches,
  // puis ils montent l'un apres l'autre quand cela devient vrai.
  entreeActive: boolean
}

// Decor anime : deux halos qui flottent et une vague en bas.
// Purement decoratif, cache aux lecteurs d'ecran et si l'animation est reduite.
function DecorAccueil() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 400 800"
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 -z-10 h-full w-full motion-reduce:hidden"
    >
      <defs>
        <radialGradient id="accueil-halo-a">
          <stop offset="0%" style={{ stopColor: 'var(--couleur-decor)', stopOpacity: 0.35 }} />
          <stop offset="100%" style={{ stopColor: 'var(--couleur-decor)', stopOpacity: 0 }} />
        </radialGradient>
        <radialGradient id="accueil-halo-b">
          <stop offset="0%" style={{ stopColor: 'var(--couleur-decor-clair)', stopOpacity: 0.7 }} />
          <stop offset="100%" style={{ stopColor: 'var(--couleur-decor-clair)', stopOpacity: 0 }} />
        </radialGradient>
      </defs>

      <circle cx="90" cy="150" r="190" fill="url(#accueil-halo-a)">
        <animateTransform
          attributeName="transform"
          type="translate"
          values="0 0; 40 50; 0 0"
          dur="14s"
          repeatCount="indefinite"
        />
      </circle>

      <circle cx="330" cy="560" r="220" fill="url(#accueil-halo-b)">
        <animateTransform
          attributeName="transform"
          type="translate"
          values="0 0; -50 -40; 0 0"
          dur="18s"
          repeatCount="indefinite"
        />
      </circle>

      <path
        d="M0 710 C 100 670, 220 750, 400 700 L400 800 L0 800 Z"
        style={{ fill: 'var(--couleur-decor-clair)', fillOpacity: 0.5 }}
      >
        <animate
          attributeName="d"
          dur="10s"
          repeatCount="indefinite"
          calcMode="spline"
          keyTimes="0;0.5;1"
          keySplines="0.4 0 0.6 1;0.4 0 0.6 1"
          values="M0 710 C 100 670, 220 750, 400 700 L400 800 L0 800 Z;
                  M0 720 C 120 760, 240 670, 400 720 L400 800 L0 800 Z;
                  M0 710 C 100 670, 220 750, 400 700 L400 800 L0 800 Z"
        />
      </path>
    </svg>
  )
}

// Fleche du bouton : avance doucement vers la droite en boucle.
function FlecheDroite() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <g>
        <animateTransform
          attributeName="transform"
          type="translate"
          values="0 0; 3 0; 0 0"
          dur="1.6s"
          repeatCount="indefinite"
        />
        <path d="M5 12h14" />
        <path d="M13 6l6 6-6 6" />
      </g>
    </svg>
  )
}

// Un bloc qui apparait en montant doucement, apres un petit retard (en millisecondes).
function Entree({
  actif,
  retard,
  children,
}: {
  actif: boolean
  retard: number
  children: ReactNode
}) {
  return (
    <div
      className={
        actif ? 'animate-monte motion-reduce:animate-none' : 'opacity-0 motion-reduce:opacity-100'
      }
      style={{ animationDelay: `${retard}ms` }}
    >
      {children}
    </div>
  )
}

// Ecran E1 : pas de carte, tout est pose directement sur la page.
// En haut : le nom de l'organisation a gauche, l'icone de langue a droite.
// Au centre : logo, point de contact, message d'accueil, duree et bouton Commencer.
export function EcranAccueil({ donnees, commencer, entreeActive }: Proprietes) {
  const { langue, t } = utiliserLangue()

  // Message du questionnaire dans la langue choisie, sinon le message par defaut.
  const messageChoisi = choisirTexte(donnees.questionnaire.message_accueil, langue).trim()
  const message = messageChoisi !== '' ? messageChoisi : t('accueil.messageParDefaut')

  return (
    <main className="relative isolate mx-auto flex min-h-svh w-full max-w-md flex-col overflow-hidden">
      <DecorAccueil />

      <div className="flex items-center justify-between gap-4 px-5 pt-[max(1rem,env(safe-area-inset-top))]">
        {/* Le nom, souligne par une ligne qui se trace de gauche a droite en s'affaiblissant. */}
        <div className="min-w-0">
          <h1
            className={
              'truncate font-titre text-xl font-semibold tracking-wide text-texte transition-opacity duration-700 motion-reduce:opacity-100 motion-reduce:transition-none ' +
              (entreeActive ? 'opacity-100' : 'opacity-0')
            }
          >
            {donnees.organisation.nom}
          </h1>
          <span
            aria-hidden="true"
            className={
              'mt-1.5 block h-[2px] w-full origin-left rounded-full transition-transform duration-1000 ease-out motion-reduce:scale-x-100 motion-reduce:transition-none ' +
              (entreeActive ? 'scale-x-100' : 'scale-x-0')
            }
            style={{
              transitionDelay: '350ms',
              background:
                'linear-gradient(90deg, var(--couleur-principale) 0%, var(--couleur-decor) 40%, transparent 100%)',
            }}
          />
        </div>

        <SelecteurLangue />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 pb-[max(4rem,env(safe-area-inset-bottom))] pt-6">
        <Entree actif={entreeActive} retard={0}>
          <EnteteQuestionnaire
            organisation={donnees.organisation}
            pointContact={donnees.point_contact}
          />
        </Entree>

        <Entree actif={entreeActive} retard={150}>
          <section className="flex flex-col items-center gap-3 text-center">
            <h2 className="font-titre text-3xl font-semibold text-texte">
              {t('accueil.titreParDefaut')}
            </h2>
            <p className="whitespace-pre-line text-base text-texte-secondaire">{message}</p>
            <p className="text-sm text-texte-secondaire">{t('accueil.duree')}</p>
          </section>
        </Entree>

        <Entree actif={entreeActive} retard={300}>
          <button
            type="button"
            onClick={commencer}
            className="inline-flex h-12 items-center justify-center gap-3 rounded-[var(--rayon-sm)] border-2 border-principale-fonce bg-transparent pl-7 pr-6 text-base font-semibold text-principale-fonce transition hover:bg-principale-fonce hover:text-texte-sur-principale active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-principale"
          >
            {t('accueil.commencer')}
            <FlecheDroite />
          </button>
        </Entree>
      </div>
    </main>
  )
}