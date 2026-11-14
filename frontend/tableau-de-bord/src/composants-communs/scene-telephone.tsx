import { utiliserLangue } from '../hooks/utiliser-langue'
import '../styles/scene-telephone.css'

// Scene de la page d'accueil (ecran large) : un telephone qui scanne un QR code,
// une orbite qui tourne derriere et quatre cartes qui flottent autour.
// Les styles et les animations sont dans styles/scene-telephone.css.
// Les textes sont dans traductions/fr/textes.ts et en/textes.ts, sous la cle "scene".

// Le QR code dessine (13 x 13 modules) : # = module plein, . = module vide.
// Trois reperes dans les coins, comme sur un vrai QR code.
const MODULES_QR = [
  '#####.#.#####',
  '#...#.#.#...#',
  '#.#.##..#.#.#',
  '#...#.#.#...#',
  '#####.#.#####',
  '.#.#..##.#..#',
  '#..#.#..#.#.#',
  '.#.#..#.#..#.',
  '#####.#..#.#.',
  '#...#..#.#..#',
  '#.#.#.#..#.#.',
  '#...#.#.#..#.',
  '#####..#.#.##',
]

const TAILLE_QR = MODULES_QR.length

// Un seul chemin SVG pour tous les modules pleins (un petit carre par module)
const CHEMIN_QR = MODULES_QR.map((ligne, y) =>
  Array.from(ligne)
    .map((module, x) => (module === '#' ? `M${x} ${y}h1v1h-1z` : ''))
    .join(''),
).join('')

const ICONE_ETOILE = 'M12 2l2.9 6.6 7.1.7-5.3 4.8 1.5 7-6.2-3.6-6.2 3.6 1.5-7L2 9.3l7.1-.7L12 2Z'

const ETOILES = [1, 2, 3, 4, 5]

export function SceneTelephone() {
  const { t } = utiliserLangue()

  return (
    <div className="scene" role="img" aria-label={t('scene.description')}>
      <div className="scene-contenu">
        {/* Lueur et orbite : tout est centre sur le telephone */}
        <div className="scene-halo" />
        <div className="scene-orbite scene-orbite-grande">
          <span className="scene-satellite" />
        </div>
        <div className="scene-orbite scene-orbite-moyenne" />

        <div className="scene-telephone">
          <p className="scene-lieu">
            {t('scene.lieu')} · <strong>{t('scene.table')}</strong>
          </p>

          {/* Le cadre du QR code : la barre de scan monte et descend dedans */}
          <div className="scene-qr">
            <svg
              className="scene-qr-dessin"
              viewBox={`0 0 ${TAILLE_QR} ${TAILLE_QR}`}
              shapeRendering="crispEdges"
            >
              <path d={CHEMIN_QR} fill="currentColor" />
            </svg>
            <span className="scene-scan" />
          </div>

          <p className="scene-invite">{t('scene.scanner')}</p>

          <div className="scene-etoiles">
            {ETOILES.map((numero) => (
              <svg key={numero} viewBox="0 0 24 24" fill="currentColor">
                <path d={ICONE_ETOILE} />
              </svg>
            ))}
          </div>
        </div>

        {/* Les quatre cartes qui flottent (positions et decalages dans le CSS) */}
        <div className="scene-carte scene-carte-note">
          <p className="scene-carte-valeur">{t('scene.noteValeur')}</p>
          <p className="scene-carte-detail">{t('scene.noteLibelle')}</p>
        </div>

        <div className="scene-carte scene-carte-avis">
          <span className="scene-point-vif" />
          <div>
            <p className="scene-carte-valeur">{t('scene.avisTitre')}</p>
            <p className="scene-carte-detail">{t('scene.avisDetail')}</p>
          </div>
        </div>

        <div className="scene-carte scene-carte-alerte">
          <svg
            className="scene-icone-alerte"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
          <div>
            <p className="scene-carte-valeur">{t('scene.alerteTitre')}</p>
            <p className="scene-carte-detail">{t('scene.alerteDetail')}</p>
          </div>
        </div>

        <div className="scene-carte scene-carte-nps">
          <svg
            className="scene-icone-nps"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M4 20v-5M12 20V9M20 20V4" />
          </svg>
          <div>
            <p className="scene-carte-valeur">{t('scene.npsValeur')}</p>
            <p className="scene-carte-detail">{t('scene.npsLibelle')}</p>
          </div>
        </div>
      </div>
    </div>
  )
}