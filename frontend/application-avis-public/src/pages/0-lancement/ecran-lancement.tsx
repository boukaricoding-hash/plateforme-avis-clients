import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { utiliserLangue } from '../../hooks/utiliser-langue'
import type { QuestionnairePublic } from '../../types/avis-public'

type Proprietes = {
  // null tant que le serveur n'a pas repondu (le cercle se dessine pendant ce temps).
  organisation: QuestionnairePublic['organisation'] | null
  // Appelee quand l'animation de sortie est finie : on peut retirer cet ecran.
  terminer: () => void
}

// Duree minimale de l'animation, meme si le serveur repond tres vite.
const DUREE_MINIMALE_MS = 2600
// Duree de l'animation de sortie (la meme que lancement-ouverture dans STYLES).
const DUREE_SORTIE_MS = 700

// Particules du fond : position (en %), taille (en px), duree et retard (en secondes).
// Valeurs fixes pour que l'animation soit toujours la meme.
const PARTICULES = [
  { x: 8, y: 72, t: 6, d: 9, r: 0 },
  { x: 18, y: 38, t: 4, d: 11, r: 1.2 },
  { x: 27, y: 84, t: 5, d: 10, r: 0.6 },
  { x: 36, y: 22, t: 3, d: 12, r: 2.1 },
  { x: 47, y: 90, t: 6, d: 9.5, r: 1.6 },
  { x: 58, y: 16, t: 4, d: 10.5, r: 0.3 },
  { x: 66, y: 78, t: 3, d: 11.5, r: 2.4 },
  { x: 74, y: 30, t: 5, d: 9, r: 0.9 },
  { x: 83, y: 64, t: 4, d: 12, r: 1.8 },
  { x: 91, y: 18, t: 6, d: 10, r: 0.4 },
  { x: 12, y: 54, t: 3, d: 11, r: 2.7 },
  { x: 88, y: 88, t: 5, d: 9.5, r: 1.1 },
]

// Mouvements propres a cet ecran (les noms commencent par « lancement- »).
// - tete : le point lumineux qui fait le tour du cercle pendant qu'il se dessine ;
// - onde : un anneau qui s'elargit en s'effacant, en boucle ;
// - reflet : un eclat de lumiere qui traverse le logo ;
// - mot : un mot du nom qui devient net en montant ;
// - flotte : une particule qui monte doucement ;
// - ouverture : un cercle s'ouvre depuis le logo et revele la page en dessous.
const STYLES = `
@property --lancement-r {
  syntax: '<percentage>';
  inherits: false;
  initial-value: 0%;
}
@keyframes lancement-tete {
  from { transform: rotate(0deg); opacity: 1; }
  88% { opacity: 1; }
  to { transform: rotate(360deg); opacity: 0; }
}
@keyframes lancement-onde {
  from { transform: scale(0.9); opacity: 0.55; }
  to { transform: scale(1.7); opacity: 0; }
}
@keyframes lancement-reflet {
  from { transform: translateX(-130%); }
  to { transform: translateX(130%); }
}
@keyframes lancement-mot {
  from { opacity: 0; transform: translateY(12px); filter: blur(6px); }
  to { opacity: 1; transform: none; filter: blur(0); }
}
@keyframes lancement-flotte {
  0% { transform: translateY(0); opacity: 0; }
  25% { opacity: 0.8; }
  100% { transform: translateY(-150px); opacity: 0; }
}
@keyframes lancement-ouverture {
  from { --lancement-r: 0%; }
  to { --lancement-r: 115%; }
}
@keyframes lancement-contenu-sortie {
  to { opacity: 0; transform: scale(0.92); }
}

.lancement-tete {
  transform-box: view-box;
  transform-origin: 80px 80px;
  animation: lancement-tete 1.4s cubic-bezier(0.65, 0, 0.35, 1) both;
}
.lancement-onde {
  animation: lancement-onde 2.6s ease-out infinite;
}
.lancement-reflet {
  animation: lancement-reflet 1s ease-in-out 0.8s both;
}
.lancement-mot {
  animation: lancement-mot 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
}
.lancement-particule {
  animation: lancement-flotte var(--duree) ease-in-out var(--retard) infinite both;
}
.lancement-sortie {
  pointer-events: none;
  -webkit-mask-image: radial-gradient(
    ellipse at 50% 44%,
    transparent calc(var(--lancement-r) - 2%),
    #000 var(--lancement-r)
  );
  mask-image: radial-gradient(
    ellipse at 50% 44%,
    transparent calc(var(--lancement-r) - 2%),
    #000 var(--lancement-r)
  );
  animation: lancement-ouverture 0.7s cubic-bezier(0.65, 0, 0.35, 1) both;
}
.lancement-sortie .lancement-contenu {
  animation: lancement-contenu-sortie 0.4s ease-in both;
}

@media (prefers-reduced-motion: reduce) {
  .lancement-tete,
  .lancement-onde,
  .lancement-reflet,
  .lancement-mot,
  .lancement-particule,
  .lancement-sortie,
  .lancement-sortie .lancement-contenu {
    animation: none;
  }
}
`

// Logo de l'organisation (ou son initiale si pas de logo), au centre du cercle,
// avec un eclat de lumiere qui le traverse une fois.
function LogoLancement({ organisation }: { organisation: QuestionnairePublic['organisation'] }) {
  // Si l'image du logo ne charge pas, on affiche l'initiale.
  const [logoEnErreur, setLogoEnErreur] = useState(false)

  const afficherLogo = organisation.logo_url !== null && !logoEnErreur
  const initiale = organisation.nom.trim().charAt(0).toUpperCase()

  return (
    <div className="relative h-24 w-24 animate-logo overflow-hidden rounded-3xl shadow-moyen motion-reduce:animate-none">
      {afficherLogo ? (
        <img
          src={organisation.logo_url ?? undefined}
          alt=""
          onError={() => setLogoEnErreur(true)}
          className="h-full w-full bg-surface object-contain p-1.5"
        />
      ) : (
        <div
          aria-hidden="true"
          className="flex h-full w-full items-center justify-center bg-principale font-titre text-4xl font-bold text-texte-sur-principale"
        >
          {initiale}
        </div>
      )}
      <div
        aria-hidden="true"
        className="lancement-reflet pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(105deg, transparent 30%, rgb(255 255 255 / 0.65) 50%, transparent 70%)',
        }}
      />
    </div>
  )
}

// Ecran d'ouverture, affiche des que le client scanne le QR code :
// des particules, un halo, un cercle en degrade qui se dessine avec un point lumineux,
// des ondes, puis le logo, le nom (mot par mot) et une phrase d'accueil.
// Il s'ouvre ensuite en cercle depuis le logo pour reveler la page, apres la duree minimale,
// ou des que le client le touche.
export function EcranLancement({ organisation, terminer }: Proprietes) {
  const { t } = utiliserLangue()

  // Animation reduite dans les reglages du telephone : on saute l'ecran d'ouverture.
  const [animationReduite] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const [dureeAtteinte, setDureeAtteinte] = useState(false)

  // Pour que le minuteur ne reparte pas a zero si la fonction terminer change.
  const terminerRef = useRef(terminer)
  useEffect(() => {
    terminerRef.current = terminer
  }, [terminer])

  // La duree minimale demarre des l'affichage de l'ecran.
  useEffect(() => {
    const minuteur = window.setTimeout(
      () => setDureeAtteinte(true),
      animationReduite ? 0 : DUREE_MINIMALE_MS,
    )
    return () => window.clearTimeout(minuteur)
  }, [animationReduite])

  // On sort quand les donnees sont la ET que la duree minimale est passee.
  const sortie = organisation !== null && dureeAtteinte

  useEffect(() => {
    if (!sortie) {
      return
    }
    const minuteur = window.setTimeout(
      () => terminerRef.current(),
      animationReduite ? 0 : DUREE_SORTIE_MS,
    )
    return () => window.clearTimeout(minuteur)
  }, [sortie, animationReduite])

  // Un toucher passe l'animation, mais seulement si les donnees sont deja la.
  const passer = () => {
    if (organisation !== null) {
      setDureeAtteinte(true)
    }
  }

  const mots = organisation !== null ? organisation.nom.trim().split(/\s+/) : []
  // La phrase d'accueil arrive apres le dernier mot du nom.
  const retardPhrase = 300 + mots.length * 120 + 150

  return (
    <div
      role="status"
      onClick={passer}
      className={
        'fixed inset-0 z-50 overflow-hidden bg-fond ' + (sortie ? 'lancement-sortie' : '')
      }
    >
      <style>{STYLES}</style>
      <span className="sr-only">{t('commun.chargement')}</span>

      {/* Particules : de petits points qui montent tres lentement derriere. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {PARTICULES.map((p) => (
          <span
            key={p.x + '-' + p.y}
            className="lancement-particule absolute rounded-full"
            style={
              {
                left: p.x + '%',
                top: p.y + '%',
                width: p.t,
                height: p.t,
                background: 'var(--couleur-decor)',
                '--duree': p.d + 's',
                '--retard': p.r + 's',
              } as CSSProperties
            }
          />
        ))}
      </div>

      <div className="lancement-contenu absolute inset-0 flex flex-col items-center justify-center gap-8 px-8">
        <div className="relative flex h-44 w-44 items-center justify-center">
          {/* Halo doux qui pulse derriere le logo. */}
          <div
            aria-hidden="true"
            className="absolute -inset-16 animate-halo rounded-full motion-reduce:animate-none"
            style={{
              background:
                'radial-gradient(circle, var(--couleur-decor-clair) 0%, transparent 65%)',
            }}
          />

          {/* Ondes : deux anneaux qui s'elargissent apres la fermeture du cercle. */}
          <div
            aria-hidden="true"
            className="lancement-onde absolute inset-0 rounded-full border-[1.5px] [animation-delay:1.5s]"
            style={{ borderColor: 'var(--couleur-decor)' }}
          />
          <div
            aria-hidden="true"
            className="lancement-onde absolute inset-0 rounded-full border-[1.5px] [animation-delay:2.8s]"
            style={{ borderColor: 'var(--couleur-decor)' }}
          />

          {/* Cercle : une piste discrete, un trait en degrade qui se dessine,
              et un point lumineux qui avance au bout du trait. */}
          <svg
            aria-hidden="true"
            viewBox="0 0 160 160"
            fill="none"
            className="absolute inset-0 h-full w-full overflow-visible"
          >
            <defs>
              <linearGradient id="lancement-degrade" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" style={{ stopColor: 'var(--couleur-principale)' }} />
                <stop offset="100%" style={{ stopColor: 'var(--couleur-decor)' }} />
              </linearGradient>
            </defs>
            <circle cx="80" cy="80" r="74" strokeWidth="2" style={{ stroke: 'var(--bordure)' }} />
            <circle
              cx="80"
              cy="80"
              r="74"
              stroke="url(#lancement-degrade)"
              strokeWidth="3"
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray={1}
              transform="rotate(-90 80 80)"
              className="animate-trace motion-reduce:animate-none"
            />
            <g className="lancement-tete">
              <circle cx="80" cy="6" r="9" style={{ fill: 'var(--couleur-decor)', opacity: 0.25 }} />
              <circle cx="80" cy="6" r="4" style={{ fill: 'var(--couleur-decor)' }} />
            </g>
          </svg>

          {organisation !== null && <LogoLancement organisation={organisation} />}
        </div>

        {/* Le nom apparait mot par mot (flou -> net), puis la phrase d'accueil. */}
        <div className="flex min-h-20 flex-col items-center gap-3">
          {organisation !== null && (
            <>
              <p className="flex flex-wrap justify-center gap-x-2.5 text-center font-titre text-3xl font-semibold text-texte">
                {mots.map((mot, index) => (
                  <span
                    key={index + mot}
                    className="lancement-mot inline-block"
                    style={{ animationDelay: 300 + index * 120 + 'ms' }}
                  >
                    {mot}
                  </span>
                ))}
              </p>
              <p
                className="animate-monte text-sm font-semibold uppercase tracking-[0.25em] text-texte-secondaire motion-reduce:animate-none"
                style={{ animationDelay: retardPhrase + 'ms' }}
              >
                {t('accueil.titreParDefaut')}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}