import { useId } from 'react'
import { Link, useNavigate } from 'react-router'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { utiliserLangue } from '../hooks/utiliser-langue'
import { construireLienAvis } from '../services/tableau-de-bord'
import type { FiltresApi, RepartitionNote } from '../types/tableau-de-bord'
import { couleurGraphiqueNote, niveauDeNoteEntiere } from '../utilitaires/couleurs-notes'

// Repartition des notes de 1 a 5 (ecran E7, jour 14).
// Refonte premium en diagramme en baton ("sucette") : pour chaque note, un trait fin qui monte depuis
// l'axe et un gros rond a son extremite, a la couleur de la note, avec le nombre d'avis au-dessus.
// Axes gradues : nombre d'avis a la verticale (avec lignes de repere), notes de 1 a 5 a l'horizontale.
// La legende est a DROITE du graphe, au centre : elle prend la largeur qu'il lui faut et le graphe
// s'adapte a l'espace restant (rien ne se superpose) ; sur petit ecran elle passe sous le graphe.
// Un clic sur un baton (ou son rond) ouvre la liste des avis de cette note.
// Le dessin prend toute la hauteur du panneau (classes accueil-remplir et accueil-zone-graphique
// de styles/accueil.css : accueil-zone-graphique n'a qu'un seul enfant direct, la rangee).
// Les liens clavier / lecteur d'ecran existent toujours, mais ils ne s'affichent qu'au focus.

type Proprietes = {
  repartition: RepartitionNote[]
  // Filtres qui ont produit les donnees affichees (pour que le lien garde la meme periode, le meme site...).
  filtres: FiltresApi | null
}

type Ligne = { note: number; nombre: number; libelle: string; part: number }

// Le backend range un avis dans la barre "k" avec Math.round(note) : la note 3,4 va dans la barre 3.
// La liste des avis filtre sur la note exacte : pour retrouver les memes avis, on demande
// de k - 0,5 inclus a k + 0,4999 (les extremites 1 et 5 sont limitees a 1 et 5).
function plageDeLaNote(note: number): { note_min: number; note_max: number } {
  return {
    note_min: note === 1 ? 1 : note - 0.5,
    note_max: note === 5 ? 5 : note + 0.4999,
  }
}

// Proprietes que recharts passe a la forme dessinee pour chaque note (position et taille de la "barre").
type ProprietesBaton = {
  x?: number | string
  y?: number | string
  width?: number | string
  height?: number | string
  payload?: Ligne
}

// Pendant l'animation recharts peut passer des valeurs vides : on les ramene a 0 pour ne jamais
// ecrire NaN dans le dessin.
function enNombre(valeur: number | string | undefined): number {
  const nombre = Number(valeur)
  return Number.isFinite(nombre) ? nombre : 0
}

// Texte explicatif de l'info-bulle : la phrase qui dit ce que represente le baton, une remarque
// eventuelle (note la plus donnee) et une invitation a cliquer.
type TexteBulle = { phrase: string; remarque: string | null; invite: string | null }

// Info-bulle affichee au survol d'un baton (recharts lui passe active et payload).
// Elle ne repete pas le chiffre deja ecrit au-dessus du rond : elle l'explique avec une phrase.
type ProprietesInfoBulle = {
  active?: boolean
  payload?: ReadonlyArray<{ payload?: Ligne }>
  texteDe?: (ligne: Ligne) => TexteBulle
}

function InfoBulle({ active, payload, texteDe }: ProprietesInfoBulle) {
  const ligne = payload?.[0]?.payload
  if (active !== true || ligne === undefined || texteDe === undefined) {
    return null
  }
  const texte = texteDe(ligne)
  return (
    <div
      className="w-56 whitespace-normal rounded-xl border bg-surface px-3.5 py-3 shadow-lg"
      style={{ borderColor: 'var(--bordure)' }}
    >
      <p className="text-sm font-bold text-texte">{ligne.libelle}</p>
      <p className="mt-1 text-xs leading-relaxed text-texte-secondaire">{texte.phrase}</p>
      {texte.remarque !== null && (
        <p className="mt-1.5 text-xs font-medium leading-relaxed text-texte">{texte.remarque}</p>
      )}
      {texte.invite !== null && (
        <p className="mt-2 text-xs leading-relaxed text-texte-secondaire">{texte.invite}</p>
      )}
    </div>
  )
}

export function GraphiqueRepartition({ repartition, filtres }: Proprietes) {
  const { t } = utiliserLangue()
  const navigate = useNavigate()
  const idTitre = useId()
  // useId renvoie des ":" qui cassent url(#...) dans le SVG : on les retire.
  const idDegrade = useId().replace(/:/g, '')

  // Texte de la legende et de l'info-bulle : la traduction si elle existe, sinon le texte francais par
  // defaut (tant que les cles ne sont pas ajoutees aux fichiers de langue, on ne voit plus la cle brute).
  function texteAvecRepli(
    cle: string,
    repli: string,
    parametres?: { note?: number; nombre?: number; part?: number },
  ): string {
    const texte = t(
      cle as Parameters<typeof t>[0],
      parametres as unknown as Parameters<typeof t>[1],
    )
    return texte === cle ? repli : texte
  }

  // Toujours cinq batons, de 1 a 5, meme si l'API n'en renvoie pas une.
  const brutes = [1, 2, 3, 4, 5].map((note) => ({
    note,
    nombre: repartition.find((ligne) => ligne.note === note)?.nombre ?? 0,
  }))
  const total = brutes.reduce((somme, ligne) => somme + ligne.nombre, 0)
  const donnees: Ligne[] = brutes.map((ligne) => ({
    ...ligne,
    libelle: t('tableau.repartition.note', { note: ligne.note }),
    part: total === 0 ? 0 : Math.round((ligne.nombre / total) * 100),
  }))

  // Pas d'animation d'entree si la personne a demande moins de mouvement.
  const animer = !window.matchMedia('(prefers-reduced-motion: reduce)').matches

  function lienDeLaNote(note: number): string {
    return construireLienAvis(filtres ?? {}, plageDeLaNote(note))
  }

  // Note la plus donnee : sert a la remarque de l'info-bulle.
  const maximum = Math.max(...donnees.map((ligne) => ligne.nombre))

  function texteDeLaBulle(ligne: Ligne): TexteBulle {
    const parametres = { note: ligne.note, nombre: ligne.nombre, part: ligne.part }
    const etoiles = ligne.note > 1 ? 'étoiles' : 'étoile'
    const pourcent = `${ligne.part}\u00A0%`

    let phrase: string
    if (ligne.nombre === 0) {
      phrase = texteAvecRepli(
        'tableau.repartition.bulle.aucun',
        `Aucun avis n’a donné la note de ${ligne.note} ${etoiles}.`,
        parametres,
      )
    } else if (ligne.nombre === 1) {
      phrase = texteAvecRepli(
        'tableau.repartition.bulle.un',
        `1 avis a donné la note de ${ligne.note} ${etoiles}, soit ${pourcent} de tous les avis.`,
        parametres,
      )
    } else {
      phrase = texteAvecRepli(
        'tableau.repartition.bulle.plusieurs',
        `${ligne.nombre} avis ont donné la note de ${ligne.note} ${etoiles}, soit ${pourcent} de tous les avis.`,
        parametres,
      )
    }

    const remarque =
      ligne.nombre > 0 && ligne.nombre === maximum
        ? texteAvecRepli('tableau.repartition.bulle.frequente', 'C’est la note la plus donnée.')
        : null
    const invite =
      ligne.nombre > 0
        ? texteAvecRepli('tableau.repartition.bulle.invite', 'Cliquez pour lire ces avis.')
        : null

    return { phrase, remarque, invite }
  }

  // Un baton par note : trait fin en degrade (plus fonce vers le haut), gros rond au bout avec un halo
  // doux, nombre d'avis au-dessus. Toute la zone autour du baton est cliquable.
  function batonDeLaNote(proprietes: ProprietesBaton) {
    const { payload } = proprietes
    if (payload === undefined) {
      return <g />
    }
    const x = enNombre(proprietes.x)
    const y = enNombre(proprietes.y)
    const largeur = enNombre(proprietes.width)
    const hauteur = Math.max(enNombre(proprietes.height), 0)
    const centre = x + largeur / 2
    const couleur = couleurGraphiqueNote(niveauDeNoteEntiere(payload.note))
    const styleRond = { transformBox: 'fill-box', transformOrigin: 'center' } as const
    const classeRond = 'transition-transform group-hover:scale-125 motion-reduce:transition-none'

    return (
      <g
        className="group cursor-pointer"
        onClick={() => {
          void navigate(lienDeLaNote(payload.note))
        }}
      >
        {/* Zone de clic large et invisible : on n'a pas besoin de viser le trait fin. */}
        <rect x={centre - 18} y={y - 26} width={36} height={hauteur + 26} fill="transparent" />
        {/* Le trait. */}
        <rect
          x={centre - 1.5}
          y={y}
          width={3}
          height={hauteur}
          rx={1.5}
          fill={`url(#${idDegrade}-${payload.note})`}
        />
        {/* Le rond au bout : halo puis coeur plein. */}
        <circle cx={centre} cy={y} r={15} fill={couleur} opacity={0.2} className={classeRond} style={styleRond} />
        <circle cx={centre} cy={y} r={9} fill={couleur} className={classeRond} style={styleRond} />
        {/* Le nombre d'avis, au-dessus du rond. */}
        <text
          x={centre}
          y={y - 24}
          textAnchor="middle"
          fill="var(--texte)"
          fontSize={13}
          fontWeight={700}
          pointerEvents="none"
        >
          {payload.nombre}
        </text>
      </g>
    )
  }

  return (
    <section
      aria-labelledby={idTitre}
      className="accueil-remplir rounded-2xl bg-surface/50 p-5"
    >
      <h2 id={idTitre} className="font-titre text-lg font-bold text-texte">
        {t('tableau.repartition.titre')}
      </h2>

      {total === 0 ? (
        <p className="mt-3 text-sm text-texte-secondaire">{t('tableau.repartition.aucun')}</p>
      ) : (
        <>
          {/* accueil-zone-graphique n'a qu'UN enfant direct (la rangee) : c'est lui que le CSS de l'accueil
              etire sur toute la zone. Dans la rangee, graphe a gauche et legende a droite au centre :
              la legende prend sa largeur, le graphe prend tout le reste (rien ne se superpose).
              Sur petit ecran : graphe puis legende dessous. */}
          <div className="accueil-zone-graphique mt-3">
          <div className="flex h-full w-full flex-col gap-4 md:flex-row">
            {/* Le dessin est masque aux lecteurs d'ecran : la liste de liens plus bas dit la meme chose. */}
            <div aria-hidden="true" className="relative min-h-0 min-w-0 flex-1">
              <div className="absolute inset-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={donnees}
                  margin={{ top: 40, right: 8, bottom: 0, left: 0 }}
                  barCategoryGap="20%"
                  accessibilityLayer={false}
                >
                  <defs>
                    {/* Un degrade vertical par note : couleur pleine en haut, plus claire vers l'axe. */}
                    {donnees.map((ligne) => {
                      const couleur = couleurGraphiqueNote(niveauDeNoteEntiere(ligne.note))
                      return (
                        <linearGradient
                          key={ligne.note}
                          id={`${idDegrade}-${ligne.note}`}
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop offset="0%" style={{ stopColor: couleur, stopOpacity: 1 }} />
                          <stop offset="100%" style={{ stopColor: couleur, stopOpacity: 0.25 }} />
                        </linearGradient>
                      )
                    })}
                  </defs>

                  {/* Lignes de repere horizontales, alignees sur les graduations de l'axe vertical. */}
                  <CartesianGrid vertical={false} stroke="var(--bordure)" strokeDasharray="3 6" />

                  {/* Axe horizontal gradue : les notes de 1 a 5. */}
                  <XAxis
                    dataKey="libelle"
                    tickLine={{ stroke: 'var(--bordure)' }}
                    tickSize={6}
                    axisLine={{ stroke: 'var(--bordure)' }}
                    tickMargin={8}
                    tick={{ fill: 'var(--texte-secondaire)', fontSize: 12 }}
                  />
                  {/* Axe vertical gradue : le nombre d'avis (entiers uniquement). */}
                  <YAxis
                    allowDecimals={false}
                    tickCount={5}
                    width={40}
                    tickLine={{ stroke: 'var(--bordure)' }}
                    tickSize={4}
                    axisLine={{ stroke: 'var(--bordure)' }}
                    tick={{ fill: 'var(--texte-secondaire)', fontSize: 12 }}
                    domain={[0, (maximum: number) => Math.ceil(maximum * 1.25)]}
                  />
                  <Tooltip content={<InfoBulle texteDe={texteDeLaBulle} />} cursor={false} />
                  <Bar
                    dataKey="nombre"
                    shape={batonDeLaNote}
                    isAnimationActive={animer}
                    animationDuration={900}
                  />
                </BarChart>
              </ResponsiveContainer>
              </div>
            </div>

            {/* Legende : a droite du graphe, au centre. Trois lignes, une idee par ligne. */}
            <ul className="flex shrink-0 flex-col gap-3 self-center rounded-xl bg-fond-alt p-3 text-xs text-texte-secondaire md:w-56">
              <li className="flex items-start gap-2.5">
                {/* Les cinq couleurs des notes, de la 1 a la 5. */}
                <span aria-hidden="true" className="mt-0.5 flex shrink-0 gap-0.5">
                  {donnees.map((ligne) => (
                    <span
                      key={ligne.note}
                      className="size-2 rounded-full"
                      style={{ backgroundColor: couleurGraphiqueNote(niveauDeNoteEntiere(ligne.note)) }}
                    />
                  ))}
                </span>
                <span>
                  {texteAvecRepli(
                    'tableau.repartition.legende.batons',
                    'Un bâton par note, de 1 à 5 étoiles',
                  )}
                </span>
              </li>
        
              <li className="flex items-start gap-2.5">
                {/* Un petit baton avec son rond, comme dans le graphe. */}
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="mt-0.5 size-3.5 shrink-0"
                  fill="currentColor"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                >
                  <path d="M12 21V10" fill="none" />
                  <circle cx="12" cy="6" r="4.5" stroke="none" />
                </svg>
                <span>
                  {texteAvecRepli(
                    'tableau.repartition.legende.clic',
                    'Cliquez sur un rond pour voir les avis de cette note',
                  )}
                </span>
              </li>
            </ul>
          </div>
          </div>

          {/* Acces clavier et lecteur d'ecran : invisible, sauf quand un lien recoit le focus. */}
          <ul className="sr-only focus-within:not-sr-only focus-within:mt-3 focus-within:grid focus-within:grid-cols-5 focus-within:gap-1 focus-within:text-center focus-within:text-xs">
            {donnees.map((ligne) => (
              <li key={ligne.note}>
                <Link
                  to={lienDeLaNote(ligne.note)}
                  aria-label={t('tableau.repartition.aria', { note: ligne.note, nombre: ligne.nombre })}
                  className="block min-h-11 rounded-md px-1 py-1.5 text-texte hover:bg-fond-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-texte"
                >
                  <span className="font-medium">{ligne.libelle}</span>
                  <span className="block text-texte-secondaire">{ligne.nombre}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}