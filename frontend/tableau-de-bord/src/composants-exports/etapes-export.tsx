import { IconeCoche } from '../composants-avis/icones-avis'
import { utiliserLangue } from '../hooks/utiliser-langue'
import type { EtapeExport } from '../types/exports'

// Les indications 1, 2, 3, 4 de l'ecran E16 (jour 21, fichier 17) :
// 1 Format, 2 Periode et filtres, 3 Generer, 4 Telecharger.
// Le composant n'affiche que l'etape donnee par le hook utiliserExport (champ etape) :
// il ne calcule rien. L'etape en cours est mise en avant, les etapes passees ont une coche,
// les etapes a venir sont discretes.
// Quand le fichier est enregistre (etape 4), les quatre etapes sont faites.
//
// Mise en page : sur telephone et tablette, les quatre etapes sont en ligne (sous la barre) ;
// a partir de lg, elles s'empilent. C'est la page (fichier 20) qui les place a droite de la barre.
// Style : classes Tailwind seulement, aucune classe a ajouter dans exports.css.
// Textes : cles exports.etapes.* (fichiers 23 et 24).
// Les lecteurs d'ecran entendent aussi l'etat de chaque etape (terminee, en cours, a venir) :
// la couleur ne suffit jamais seule.

type PropsEtapesExport = {
  etape: EtapeExport
}

type Indication = {
  numero: EtapeExport
  cleTexte: string
}

const INDICATIONS: readonly Indication[] = [
  { numero: 1, cleTexte: 'exports.etapes.format' },
  { numero: 2, cleTexte: 'exports.etapes.periode' },
  { numero: 3, cleTexte: 'exports.etapes.generer' },
  { numero: 4, cleTexte: 'exports.etapes.telecharger' },
]

export function EtapesExport({ etape }: PropsEtapesExport) {
  const { t } = utiliserLangue()

  return (
    <ol
      aria-label={t('exports.etapes.titre')}
      className="m-0 grid w-full list-none grid-cols-4 gap-2 p-0 lg:w-auto lg:grid-cols-1 lg:gap-3"
    >
      {INDICATIONS.map(({ numero, cleTexte }) => {
        const courante = numero === etape
        // A l'etape 4, le fichier est enregistre : tout est fait.
        const terminee = numero < etape || etape === 4
        const cleEtat = terminee
          ? 'exports.etapes.etatTerminee'
          : courante
            ? 'exports.etapes.etatEnCours'
            : 'exports.etapes.etatAVenir'

        const classeRond = terminee
          ? 'border-principale bg-principale text-texte-sur-principale'
          : courante
            ? 'border-principale bg-surface text-texte'
            : 'border-bordure-champ bg-transparent text-texte-secondaire'
        const classeTexte = courante || terminee ? 'text-texte' : 'text-texte-secondaire'

        return (
          <li
            key={numero}
            aria-current={courante ? 'step' : undefined}
            className="flex min-w-0 flex-col items-center gap-1.5 text-center lg:flex-row lg:gap-3 lg:text-left"
          >
            <span
              aria-hidden="true"
              className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors ${classeRond} ${
                courante && !terminee ? 'shadow-doux' : ''
              }`}
            >
              {terminee ? <IconeCoche width={16} height={16} /> : numero}
            </span>
            <span className={`min-w-0 text-xs leading-tight transition-colors lg:text-sm ${classeTexte} ${courante ? 'font-semibold' : ''}`}>
              {t(cleTexte)}
              <span className="sr-only">{` : ${t(cleEtat)}`}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}