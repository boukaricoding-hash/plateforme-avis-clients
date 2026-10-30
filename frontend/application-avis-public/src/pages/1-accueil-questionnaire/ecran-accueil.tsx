import { useState } from 'react'
import type { ReactNode } from 'react'
import { EnteteQuestionnaire } from '../../composants/entete-questionnaire'
import { Mascotte } from '../../composants/mascotte'
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

// Fond de la page : du peche tres clair en haut (le ton du haut de la mascotte),
// puis le beige de la page, puis un beige rose un peu plus soutenu en bas.
// Le degrade est deux fois plus haut que l'ecran et glisse tres lentement (voir STYLES).
const FOND_ACCUEIL =
  'linear-gradient(170deg, color-mix(in srgb, var(--couleur-decor-clair) 40%, var(--fond-alt)) 0%, var(--fond) 35%, var(--fond-alt) 62%, var(--surface-douce) 100%)'

// Mouvements du fond (les noms commencent par « accueil- »).
// - lumiere : le degrade glisse tres lentement de haut en bas, puis revient ;
// - vague : la vague defile d'une demi-largeur puis recommence (le dessin se repete, donc sans coupure).
const STYLES = `
@keyframes accueil-lumiere {
  from { background-position: 0% 0%; }
  to { background-position: 0% 100%; }
}
@keyframes accueil-vague {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}

.accueil-fond {
  background-size: 100% 220%;
  animation: accueil-lumiere 28s ease-in-out infinite alternate;
}
.accueil-vague-1 {
  animation: accueil-vague 24s linear infinite;
}
.accueil-vague-2 {
  animation: accueil-vague 15s linear infinite reverse;
}

@media (prefers-reduced-motion: reduce) {
  .accueil-fond,
  .accueil-vague-1,
  .accueil-vague-2 {
    animation: none;
  }
}
`

// Une vague : le dessin se repete deux fois (800 de large, periode 400),
// donc en la decalant de la moitie on retombe exactement sur le meme dessin.
const VAGUE = 'M0 50 C 100 10, 300 90, 400 50 C 500 10, 700 90, 800 50 L800 100 L0 100 Z'

// Decor : un degrade qui glisse tres lentement, une trame de points fins qui s'efface vers le bas,
// et deux vagues basses. Sobre, dans les tons de la mascotte.
// Purement decoratif : cache aux lecteurs d'ecran et sans effet sur les clics.
function DecorAccueil() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      <style>{STYLES}</style>

      {/* Degrade qui glisse */}
      <div className="accueil-fond absolute inset-0" style={{ background: FOND_ACCUEIL, backgroundSize: '100% 220%' }} />

      {/* Trame de points fins, plus visible en haut, effacee vers le bas */}
      <svg
        className="absolute inset-0 h-full w-full"
        style={{
          opacity: 0.07,
          WebkitMaskImage: 'linear-gradient(180deg, #000 0%, transparent 70%)',
          maskImage: 'linear-gradient(180deg, #000 0%, transparent 70%)',
        }}
      >
        <defs>
          <pattern id="accueil-points" width="22" height="22" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.2" style={{ fill: 'var(--texte)' }} />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#accueil-points)" />
      </svg>

      {/* Vagues : deux couches qui defilent doucement en sens inverses. */}
      <div className="accueil-vague-1 absolute bottom-0 left-0 h-36 w-[200%]">
        <svg viewBox="0 0 800 100" preserveAspectRatio="none" className="h-full w-full">
          <path d={VAGUE} style={{ fill: 'var(--surface-douce)', fillOpacity: 0.9 }} />
        </svg>
      </div>
      <div className="accueil-vague-2 absolute bottom-0 left-0 h-24 w-[200%]">
        <svg viewBox="0 0 800 100" preserveAspectRatio="none" className="h-full w-full">
          <path d={VAGUE} style={{ fill: 'var(--couleur-decor-clair)', fillOpacity: 0.4 }} />
        </svg>
      </div>
    </div>
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

// Petit logo de l'organisation (ou son initiale si pas de logo), a gauche du nom.
function LogoEntete({ organisation }: { organisation: QuestionnairePublic['organisation'] }) {
  // Si l'image du logo ne charge pas, on affiche l'initiale.
  const [logoEnErreur, setLogoEnErreur] = useState(false)

  const afficherLogo = organisation.logo_url !== null && !logoEnErreur
  const initiale = organisation.nom.trim().charAt(0).toUpperCase()

  return afficherLogo ? (
    <img
      src={organisation.logo_url ?? undefined}
      alt=""
      onError={() => setLogoEnErreur(true)}
      className="h-11 w-11 shrink-0 rounded-xl bg-surface object-contain p-1 shadow-doux"
    />
  ) : (
    <div
      aria-hidden="true"
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-principale font-titre text-xl font-bold text-texte-sur-principale shadow-doux"
    >
      {initiale}
    </div>
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

// Ecran E1 : pas de carte, tout est pose directement sur la page, devant un fond sobre et vivant.
// En haut : le logo et le nom de l'organisation a gauche, l'icone de langue a droite.
// Au centre : mascotte, numero de table en gras, message d'accueil, duree et bouton Commencer.
export function EcranAccueil({ donnees, commencer, entreeActive }: Proprietes) {
  const { langue, t } = utiliserLangue()

  // Message du questionnaire dans la langue choisie, sinon le message par defaut.
  const messageChoisi = choisirTexte(donnees.questionnaire.message_accueil, langue).trim()
  const message = messageChoisi !== '' ? messageChoisi : t('accueil.messageParDefaut')

  return (
    <div
      className="relative isolate min-h-svh w-full overflow-hidden"
      style={{ background: 'var(--fond)' }}
    >
      <DecorAccueil />

      <main className="mx-auto flex min-h-svh w-full max-w-md flex-col">
        <div className="flex items-center justify-between gap-4 px-5 pt-[max(1rem,env(safe-area-inset-top))]">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={
                'transition-opacity duration-700 motion-reduce:opacity-100 motion-reduce:transition-none ' +
                (entreeActive ? 'opacity-100' : 'opacity-0')
              }
            >
              <LogoEntete organisation={donnees.organisation} />
            </div>

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
          </div>

          <SelecteurLangue />
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 pb-[max(4rem,env(safe-area-inset-bottom))] pt-4">
          <Entree actif={entreeActive} retard={0}>
            <Mascotte humeur="accueil" taille={170} />
          </Entree>

          <Entree actif={entreeActive} retard={150}>
            <EnteteQuestionnaire pointContact={donnees.point_contact} />
          </Entree>

          <Entree actif={entreeActive} retard={300}>
            <section className="flex flex-col items-center gap-3 text-center">
              <h2 className="font-titre text-3xl font-semibold text-texte">
                {t('accueil.titreParDefaut')}
              </h2>
              <p className="whitespace-pre-line text-base text-texte-secondaire">{message}</p>
              <p className="text-sm text-texte-secondaire">{t('accueil.duree')}</p>
            </section>
          </Entree>

          <Entree actif={entreeActive} retard={450}>
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
    </div>
  )
}