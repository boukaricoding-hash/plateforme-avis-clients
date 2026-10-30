import { utiliserLangue } from '../hooks/utiliser-langue'

type Proprietes = {
  // Numero de la question affichee (a partir de 1).
  courant: number
  // Nombre total de questions.
  total: number
}

// Nombre maximum de bulles visibles en meme temps. Au-dela, la rangee glisse
// pour garder la bulle courante a peu pres au centre.
const BULLES_MAX = 6

type EtatBulle = 'fait' | 'courant' | 'a-venir'

// Une bulle numerotee :
// - fait : pleine, couleur principale ;
// - courant : plus grande, couleur foncee, avec un petit rebond quand elle arrive ;
// - a venir : un simple contour.
function Bulle({ numero, etat }: { numero: number; etat: EtatBulle }) {
  const styles: Record<EtatBulle, string> = {
    fait: 'h-[26px] w-[26px] bg-principale text-xs text-texte-sur-principale',
    courant: 'h-9 w-9 bg-principale-fonce text-sm text-texte-sur-principale shadow-moyen',
    'a-venir': 'h-[26px] w-[26px] border-[1.5px] border-bordure-forte text-xs text-texte-secondaire',
  }

  return (
    <span
      className={
        'flex shrink-0 items-center justify-center rounded-full font-semibold transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none ' +
        styles[etat]
      }
    >
      {numero}
    </span>
  )
}

// Le petit trait entre deux bulles : il se remplit quand on avance.
function Liaison({ remplie }: { remplie: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="relative block h-[2px] w-3 shrink-0 overflow-hidden rounded-full bg-bordure-forte"
    >
      <span
        className={
          'absolute inset-0 origin-left bg-principale transition-transform duration-500 motion-reduce:transition-none ' +
          (remplie ? 'scale-x-100' : 'scale-x-0')
        }
      />
    </span>
  )
}

// Progression du questionnaire : une rangee de bulles numerotees, a la place d'une barre.
export function ProgressionBulles({ courant, total }: Proprietes) {
  const { t } = utiliserLangue()

  if (total <= 0) {
    return null
  }

  const nombre = Math.min(total, BULLES_MAX)
  // Premiere bulle visible (a partir de 0), en gardant la bulle courante vers le milieu.
  const debut = Math.min(Math.max(courant - 1 - Math.floor(nombre / 2), 0), total - nombre)
  const numeros = Array.from({ length: nombre }, (_, i) => debut + 1 + i)

  return (
    <nav aria-label={t('question.progression', { courant, total })}>
      <ol className="flex items-center justify-center">
        {numeros.map((numero, i) => {
          const etat: EtatBulle =
            numero < courant ? 'fait' : numero === courant ? 'courant' : 'a-venir'
          return (
            <li
              key={numero}
              className="flex items-center"
              aria-current={etat === 'courant' ? 'step' : undefined}
            >
              {i > 0 ? <Liaison remplie={numero <= courant} /> : null}
              <Bulle numero={numero} etat={etat} />
            </li>
          )
        })}
      </ol>
    </nav>
  )
}