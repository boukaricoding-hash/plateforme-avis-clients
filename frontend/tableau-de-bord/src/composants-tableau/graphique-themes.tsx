import { useEffect, useId, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  ReferenceArea,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts'
import { utiliserLangue } from '../hooks/utiliser-langue'
import type { ScoreTheme } from '../types/tableau-de-bord'
import {
  SEUIL_NOTE_BONNE,
  SEUIL_NOTE_MOYENNE,
  classeFondClairNote,
  classeTexteNote,
  cleTexteNiveau,
  couleurGraphiqueNote,
  niveauDeLaNote,
} from '../utilitaires/couleurs-notes'
import type { NiveauNote } from '../utilitaires/couleurs-notes'
import { formaterNombre } from '../utilitaires/periodes'

// Score par theme, sur 5, points faibles en premier (ecran E7, jour 14).
// Refonte premium : un "nuage de bulles". Une ligne par theme, avec son nom complet a gauche (sur
// deux lignes si besoin), et une grosse bulle placee sur l'echelle de 0 a 5. La note est ecrite DANS
// la bulle, a la couleur de son niveau : plus de texte a cote, plus de trait, plus de bandes dures.
// Le fond est un seul degrade doux (rouge, orange, vert) qui suit les seuils des notes.
// L'echelle 0 a 5 reste collee en haut du cadre pendant le defilement.
// Le pop-up (nom, note, niveau, reponses, explication) s'ouvre UNIQUEMENT au clic sur une bulle,
// jamais au simple survol de la ligne. Il se ferme avec un nouveau clic sur la bulle, un clic
// ailleurs, la touche Echap, la croix, ou quand on fait defiler la liste.
// La hauteur suit le nombre de themes, et le graphique defile dans son cadre. Le cadre s'adapte a la
// hauteur de l'ecran (au maximum 22 rem, moins la place du titre et de la legende) : la page ne
// s'allonge pas et rien n'est coupe, meme avec des dizaines de themes.
// L'API envoie deja les themes tries du plus faible au meilleur, sans limite de nombre.
// Pas de lien vers les avis ici : la liste des avis n'a pas de filtre par theme.

const HAUTEUR_PAR_THEME = 40
const HAUTEUR_MARGES = 8
const HAUTEUR_MINIMUM = 80
// Largeur de la colonne des noms ; la meme valeur sert a aligner l'echelle collee en haut.
const LARGEUR_NOMS = 130
const MARGE_DROITE = 24
const LONGUEUR_LIGNE_NOM = 20
const RAYON_BULLE = 14
const LARGEUR_FENETRE = 240
const ECART_FENETRE = 8
const SCORE_MAXIMUM = 5
const GRADUATIONS = [0, 1, 2, 3, 4, 5]

type Proprietes = {
  themes: ScoreTheme[]
}

// Un theme pret a l'affichage.
type LigneTheme = {
  id: string
  nom: string
  score: number
  niveau: NiveauNote | null
  // Texte deja formate : le meme partout (bulle du graphique, pop-up, liste cachee).
  texteScore: string
  nombreReponses: number
}

// Bulle ouverte, avec sa position mesuree au moment du clic (en pixels, par rapport au cadre).
type Selection = {
  id: string
  centre: number
  haut: number
  bas: number
  largeurCadre: number
  hauteurCadre: number
}

type FonctionT = ReturnType<typeof utiliserLangue>['t']

// Texte traduit si la cle existe, sinon le texte francais par defaut (on ne voit jamais la cle brute).
function texteAvecRepli(t: FonctionT, cle: string, repli: string): string {
  const texte = t(cle as Parameters<FonctionT>[0])
  return texte === cle ? repli : texte
}

// Coupe un nom en deux lignes au maximum, sans couper les mots, et termine par "…" s'il est trop long.
// Le nom complet reste dans le pop-up et dans la liste cachee.
function couper(ligne: string): string {
  return ligne.length > LONGUEUR_LIGNE_NOM ? `${ligne.slice(0, LONGUEUR_LIGNE_NOM - 1)}…` : ligne
}

function decouperNom(nom: string): string[] {
  const lignes: string[] = []
  let courante = ''
  for (const mot of nom.split(' ')) {
    const essai = courante === '' ? mot : `${courante} ${mot}`
    if (courante === '' || essai.length <= LONGUEUR_LIGNE_NOM) {
      courante = essai
    } else {
      lignes.push(courante)
      courante = mot
    }
  }
  if (courante !== '') {
    lignes.push(courante)
  }
  if (lignes.length <= 1) {
    return lignes.map(couper)
  }
  // Au-dela de deux lignes, tout le reste est regroupe sur la seconde (puis raccourci).
  return [couper(lignes[0] ?? ''), couper(lignes.slice(1).join(' '))]
}

// Ce que recharts envoie a chaque nom de l'axe : x et y peuvent etre du texte ou un nombre.
type ProprietesAxeNom = {
  x?: number | string
  y?: number | string
  payload?: { value?: string | number }
}

// Nom du theme sur l'axe de gauche (une ou deux lignes, centre sur la ligne du theme).
type ProprietesNom = ProprietesAxeNom & {
  noms: ReadonlyMap<string, string>
}

function NomTheme({ x = 0, y = 0, payload, noms }: ProprietesNom) {
  const positionX = Number(x)
  const positionY = Number(y)
  const nom = noms.get(String(payload?.value ?? '')) ?? ''
  const lignes = decouperNom(nom)
  return (
    <text x={positionX} y={positionY} textAnchor="end" fill="var(--texte)" fontSize={12}>
      {lignes.map((ligne, index) => (
        <tspan
          key={`${index}-${ligne}`}
          x={positionX}
          dy={index === 0 ? (lignes.length === 1 ? '0.35em' : '-0.25em') : '1.2em'}
        >
          {ligne}
        </tspan>
      ))}
    </text>
  )
}

// Forme dessinee pour chaque theme : une bulle ronde avec un halo doux, la note ecrite dedans.
// recharts donne la position (x, y) et la taille (width, height) de la barre invisible : le bout
// de cette barre est la position de la note sur l'echelle.
// Seule la bulle reagit au clic : le reste de la ligne ne fait rien.
type ProprietesBulleScore = {
  x?: number
  y?: number
  width?: number
  height?: number
  payload?: LigneTheme
  selectionne?: boolean
  onChoisir?: (id: string, element: SVGGElement) => void
}

function BulleScore({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  payload,
  selectionne = false,
  onChoisir,
}: ProprietesBulleScore) {
  if (payload === undefined) {
    return null
  }
  const couleur = couleurGraphiqueNote(payload.niveau)
  const centreY = y + height / 2
  const centreX = x + Math.max(width, 0)
  const styleRond = { transformBox: 'fill-box', transformOrigin: 'center' } as const
  const classeRond = 'transition-transform group-hover:scale-110 motion-reduce:transition-none'

  return (
    <g
      data-bulle-theme=""
      className="group cursor-pointer"
      onClick={(evenement) => {
        evenement.stopPropagation()
        onChoisir?.(payload.id, evenement.currentTarget)
      }}
    >
      <circle
        cx={centreX}
        cy={centreY}
        r={RAYON_BULLE + 4}
        fill={couleur}
        opacity={selectionne ? 0.3 : 0.16}
        className={classeRond}
        style={styleRond}
      />
      <circle
        cx={centreX}
        cy={centreY}
        r={RAYON_BULLE}
        fill={couleur}
        className={classeRond}
        style={styleRond}
      />
      {/* Anneau autour de la bulle ouverte. */}
      {selectionne && (
        <circle
          cx={centreX}
          cy={centreY}
          r={RAYON_BULLE + 5}
          fill="none"
          stroke={couleur}
          strokeWidth={2}
        />
      )}
      {/* Texte a la couleur du fond de la carte : lisible sur toutes les couleurs de bulle. */}
      <text
        x={centreX}
        y={centreY}
        textAnchor="middle"
        dominantBaseline="central"
        fill="var(--surface)"
        fontSize={10.5}
        fontWeight={700}
        pointerEvents="none"
      >
        {payload.texteScore}
      </text>
    </g>
  )
}

// Pop-up ouvert au clic sur une bulle : nom complet, note, niveau, nombre de reponses et une phrase
// qui explique ce que veut dire cette note (le nom et la note sont deja visibles, la phrase apporte
// le sens). Il se place au-dessus ou en dessous de la bulle, sans depasser du cadre.
type ProprietesFenetre = {
  ligne: LigneTheme
  position: CSSProperties
  onFermer: () => void
}

function FenetreTheme({ ligne, position, onFermer }: ProprietesFenetre) {
  const { t } = utiliserLangue()

  let conclusion: string
  if (ligne.score < SEUIL_NOTE_MOYENNE) {
    conclusion = texteAvecRepli(
      t,
      'tableau.themes.bulle.faible',
      'Point faible : ce thème mérite une attention en priorité.',
    )
  } else if (ligne.score < SEUIL_NOTE_BONNE) {
    conclusion = texteAvecRepli(
      t,
      'tableau.themes.bulle.moyen',
      'Thème correct : il reste une marge de progression.',
    )
  } else {
    conclusion = texteAvecRepli(
      t,
      'tableau.themes.bulle.fort',
      'Point fort : les clients sont satisfaits de ce thème.',
    )
  }

  return (
    <div
      data-fenetre-theme=""
      role="dialog"
      aria-label={ligne.nom}
      className="absolute z-20 whitespace-normal rounded-xl border border-bordure bg-surface px-3.5 py-3 shadow-moyen"
      style={{ width: LARGEUR_FENETRE, maxWidth: '100%', ...position }}
    >
      <button
        type="button"
        onClick={onFermer}
        aria-label={texteAvecRepli(t, 'tableau.themes.bulle.fermer', 'Fermer')}
        className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-md text-texte-secondaire hover:bg-fond-alt hover:text-texte focus-visible:outline focus-visible:outline-2 focus-visible:outline-texte"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
        >
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
      <p className="pr-6 text-sm font-semibold text-texte">{ligne.nom}</p>
      <p className={`mt-1 font-titre text-lg font-bold leading-none ${classeTexteNote(ligne.niveau)}`}>
        {ligne.texteScore}
        <span className="ml-1 text-xs font-normal text-texte-secondaire">/ {SCORE_MAXIMUM}</span>
      </p>
      {ligne.niveau !== null && (
        <span
          className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${classeFondClairNote(
            ligne.niveau,
          )} ${classeTexteNote(ligne.niveau)}`}
        >
          {t(cleTexteNiveau(ligne.niveau))}
        </span>
      )}
      <p className="mt-2 text-xs text-texte-secondaire">
        {t('tableau.themes.reponses', { nombre: ligne.nombreReponses })}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-texte">{conclusion}</p>
    </div>
  )
}

export function GraphiqueThemes({ themes }: Proprietes) {
  const { t, langue } = utiliserLangue()
  const idTitre = useId()
  // useId renvoie des ":" qui cassent url(#...) dans le SVG : on les retire.
  const idFond = `${useId().replace(/:/g, '')}-fond`
  // Cadre de reference pour placer le pop-up (il contient la zone qui defile, sans defiler lui-meme).
  const refCadre = useRef<HTMLDivElement>(null)
  const [selection, setSelection] = useState<Selection | null>(null)

  // Tant qu'un pop-up est ouvert : Echap, redimensionnement ou clic ailleurs (hors bulle et hors
  // pop-up) le ferment. Un clic sur une bulle est gere par la bulle elle-meme.
  useEffect(() => {
    if (selection === null) {
      return undefined
    }
    function fermer() {
      setSelection(null)
    }
    function surTouche(evenement: KeyboardEvent) {
      if (evenement.key === 'Escape') {
        fermer()
      }
    }
    function surAppui(evenement: PointerEvent) {
      const cible = evenement.target
      if (
        cible instanceof Element &&
        cible.closest('[data-bulle-theme], [data-fenetre-theme]') !== null
      ) {
        return
      }
      fermer()
    }
    window.addEventListener('keydown', surTouche)
    window.addEventListener('resize', fermer)
    document.addEventListener('pointerdown', surAppui)
    return () => {
      window.removeEventListener('keydown', surTouche)
      window.removeEventListener('resize', fermer)
      document.removeEventListener('pointerdown', surAppui)
    }
  }, [selection])

  const animer = !window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const donnees: LigneTheme[] = themes.map((theme) => ({
    id: theme.theme_id,
    nom: langue === 'en' && theme.libelle_en !== '' ? theme.libelle_en : theme.libelle_fr,
    score: theme.score,
    niveau: niveauDeLaNote(theme.score),
    texteScore: formaterNombre(theme.score, langue, { decimales: 2 }),
    nombreReponses: theme.nb_reponses,
  }))

  // L'axe de gauche est range par identifiant (deux themes peuvent avoir le meme nom) ;
  // ce tableau retrouve le nom a afficher.
  const nomsParId = new Map<string, string>(
    donnees.map((ligne): [string, string] => [ligne.id, ligne.nom]),
  )

  const hauteurGraphique = Math.max(HAUTEUR_MINIMUM, donnees.length * HAUTEUR_PAR_THEME + HAUTEUR_MARGES)

  // Positions du degrade de fond : rouge au debut, orange au milieu de la zone "moyenne", vert a la fin.
  const positionMoyenne = ((SEUIL_NOTE_MOYENNE + SEUIL_NOTE_BONNE) / 2 / SCORE_MAXIMUM) * 100

  // Clic sur une bulle : on mesure sa place a l'ecran par rapport au cadre pour y poser le pop-up.
  // Un second clic sur la meme bulle le ferme.
  function choisir(id: string, element: SVGGElement) {
    const cadre = refCadre.current
    if (cadre === null) {
      return
    }
    if (selection?.id === id) {
      setSelection(null)
      return
    }
    const rond = element.getBoundingClientRect()
    const zone = cadre.getBoundingClientRect()
    setSelection({
      id,
      centre: rond.left + rond.width / 2 - zone.left,
      haut: rond.top - zone.top,
      bas: rond.bottom - zone.top,
      largeurCadre: zone.width,
      hauteurCadre: zone.height,
    })
  }

  // Le pop-up passe au-dessus de la bulle si elle est dans la moitie basse du cadre, sinon en dessous ;
  // il reste toujours dans la largeur du cadre.
  const ligneOuverte =
    selection === null ? null : (donnees.find((ligne) => ligne.id === selection.id) ?? null)
  let positionFenetre: CSSProperties = {}
  if (selection !== null) {
    const gauche = Math.min(
      Math.max(selection.centre - LARGEUR_FENETRE / 2, 0),
      Math.max(selection.largeurCadre - LARGEUR_FENETRE, 0),
    )
    const auDessus = selection.haut > selection.hauteurCadre / 2
    positionFenetre = auDessus
      ? { left: gauche, bottom: selection.hauteurCadre - selection.haut + ECART_FENETRE }
      : { left: gauche, top: selection.bas + ECART_FENETRE }
  }

  return (
    <section
      aria-labelledby={idTitre}
      className="flex min-h-0 flex-col rounded-lg border border-bordure bg-surface p-4 shadow-doux"
    >
      <h2 id={idTitre} className="font-titre text-lg font-bold text-texte">
        {t('tableau.themes.titre')}
      </h2>

      {donnees.length === 0 ? (
        <p className="mt-3 text-sm text-texte-secondaire">{t('tableau.themes.aucun')}</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-texte-secondaire">{t('tableau.themes.description')}</p>

          {/* Cadre de reference du pop-up : il ne defile pas, la zone qui defile est a l'interieur. */}
          <div ref={refCadre} className="relative mt-3 flex min-h-0 flex-1 flex-col">
            {/* Zone qui defile quand il y a beaucoup de themes. Atteignable au clavier. */}
            <div
              tabIndex={0}
              role="region"
              aria-label={t('tableau.themes.titre')}
              className="max-h-[min(22rem,calc(100dvh-15rem))] min-h-[8rem] flex-1 overflow-y-auto rounded-lg"
              onScroll={() => setSelection(null)}
            >
              {/* Echelle de 0 a 5, collee en haut pendant le defilement. Elle est alignee sur la zone
                  du dessin : meme marge a gauche (colonne des noms) et a droite que le graphique. */}
              <div aria-hidden="true" className="sticky top-0 z-10 bg-surface pb-1">
                <div
                  className="relative h-4"
                  style={{ marginLeft: LARGEUR_NOMS, marginRight: MARGE_DROITE }}
                >
                  {GRADUATIONS.map((graduation) => (
                    <span
                      key={graduation}
                      className="absolute top-0 -translate-x-1/2 text-xs font-medium tabular-nums text-texte-secondaire"
                      style={{ left: `${(graduation / SCORE_MAXIMUM) * 100}%` }}
                    >
                      {graduation}
                    </span>
                  ))}
                </div>
              </div>

              {/* Le dessin est masque aux lecteurs d'ecran : la liste cachee ci-dessous dit la meme chose. */}
              <div aria-hidden="true">
                <ResponsiveContainer width="100%" height={hauteurGraphique}>
                  <ComposedChart
                    data={donnees}
                    layout="vertical"
                    margin={{ top: 4, right: MARGE_DROITE, bottom: 4, left: 0 }}
                    accessibilityLayer={false}
                  >
                    <defs>
                      {/* Un seul fond en degrade, de gauche a droite : les couleurs des niveaux de note. */}
                      <linearGradient id={idFond} x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" style={{ stopColor: 'var(--note-mauvaise)', stopOpacity: 0.1 }} />
                        <stop
                          offset={`${positionMoyenne}%`}
                          style={{ stopColor: 'var(--note-moyenne)', stopOpacity: 0.08 }}
                        />
                        <stop offset="100%" style={{ stopColor: 'var(--note-bonne)', stopOpacity: 0.1 }} />
                      </linearGradient>
                    </defs>
                    <ReferenceArea x1={0} x2={SCORE_MAXIMUM} fill={`url(#${idFond})`} />
                    {/* Lignes de repere : une par graduation (verticale) et une par theme (horizontale). */}
                    <CartesianGrid stroke="var(--bordure)" strokeDasharray="3 6" />
                    <XAxis type="number" domain={[0, SCORE_MAXIMUM]} ticks={GRADUATIONS} hide />
                    <YAxis
                      type="category"
                      dataKey="id"
                      width={LARGEUR_NOMS}
                      tickLine={false}
                      axisLine={false}
                      interval={0}
                      tickMargin={12}
                      tick={(proprietes: ProprietesAxeNom) => (
                        <NomTheme
                          x={proprietes.x}
                          y={proprietes.y}
                          payload={proprietes.payload}
                          noms={nomsParId}
                        />
                      )}
                    />
                    {/* Pas d'info-bulle au survol : le pop-up s'ouvre seulement au clic sur une bulle. */}
                    <Bar
                      dataKey="score"
                      barSize={24}
                      fill="transparent"
                      shape={(proprietes: ProprietesBulleScore) => (
                        <BulleScore
                          {...proprietes}
                          selectionne={selection !== null && selection.id === proprietes.payload?.id}
                          onChoisir={choisir}
                        />
                      )}
                      isAnimationActive={animer}
                      animationDuration={800}
                      animationEasing="ease-out"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <ul className="sr-only">
                {donnees.map((ligne) => (
                  <li key={ligne.id}>
                    {ligne.nom} : {t('tableau.cartes.noteSur5', { note: ligne.texteScore })},{' '}
                    {t('tableau.themes.reponses', { nombre: ligne.nombreReponses })}
                  </li>
                ))}
              </ul>
            </div>

            {ligneOuverte !== null && (
              <FenetreTheme
                ligne={ligneOuverte}
                position={positionFenetre}
                onFermer={() => setSelection(null)}
              />
            )}
          </div>

          <p className="mt-2 text-xs text-texte-secondaire">{t('tableau.cartes.legendeNote')}</p>
        </>
      )}
    </section>
  )
}