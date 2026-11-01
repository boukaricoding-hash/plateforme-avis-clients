import { Link } from 'react-router'
import { utiliserLangue } from '../hooks/utiliser-langue'
import { formaterNombre } from '../utilitaires/periodes'

// Une carte de chiffre cle de l'ecran E7 : note moyenne, CSAT, NPS, avis, taux de reponse, alertes.
// La page fournit les textes deja prets ; la carte s'occupe de la mise en forme.
// Une valeur a null veut dire "aucune donnee" : on ecrit "Pas de donnees", jamais 0.

// Variation par rapport a la periode precedente.
// valeur : ecart signe (null = pas de comparaison possible), unite : "pts", "%" ou "".
export type VariationCarte = {
  valeur: number | null
  unite: string
  decimales: number
}

type Proprietes = {
  titre: string
  // Valeur deja formatee, ou null s'il n'y a pas de donnees.
  valeur: string | null
  // Petite unite a cote de la valeur : "%", "/ 5"...
  unite?: string
  // Classe Tailwind de la couleur de la valeur (voir utilitaires/couleurs-notes.ts).
  classeValeur?: string
  // Pastille de texte sous la valeur (niveau de la note) : le texte evite de compter sur la couleur seule.
  badge?: { texte: string; classes: string }
  variation?: VariationCarte
  // Petit texte d'explication tout en bas.
  aide?: string
  // Si renseigne, toute la carte est un lien vers la liste des avis concernes.
  lien?: string
}

const CLASSES_CARTE = 'block rounded-lg border border-bordure bg-surface p-4 shadow-doux'

export function Variation({ variation }: { variation: VariationCarte }) {
  const { t, langue } = utiliserLangue()
  const { valeur, unite, decimales } = variation

  if (valeur === null) {
    return <p className="mt-2 text-xs text-texte-secondaire">{t('tableau.cartes.evolution.aucune')}</p>
  }

  const legende = t('tableau.cartes.evolution.vsPrecedente')

  if (valeur === 0) {
    return (
      <p className="mt-2 text-xs text-texte-secondaire">
        {t('tableau.cartes.evolution.stable')} {legende}
      </p>
    )
  }

  const hausse = valeur > 0
  const nombre = formaterNombre(Math.abs(valeur), langue, { decimales })
  const texteValeur = unite === '' ? nombre : `${nombre} ${unite}`
  const resume = t(hausse ? 'tableau.cartes.evolution.hausse' : 'tableau.cartes.evolution.baisse', {
    valeur: texteValeur,
  })

  return (
    <p className="mt-2 text-xs text-texte-secondaire">
      <span aria-hidden="true" className={`font-semibold ${hausse ? 'text-succes' : 'text-erreur'}`}>
        {hausse ? '▲ +' : '▼ −'}
        {texteValeur}
      </span>
      <span className="sr-only">{resume}</span> <span>{legende}</span>
    </p>
  )
}

export function CarteIndicateur({
  titre,
  valeur,
  unite,
  classeValeur = 'text-texte',
  badge,
  variation,
  aide,
  lien,
}: Proprietes) {
  const { t } = utiliserLangue()

  const contenu = (
    <>
      <p className="text-sm font-medium text-texte-secondaire">{titre}</p>

      <p className="mt-1 flex flex-wrap items-baseline gap-x-1">
        {valeur === null ? (
          <span className="text-lg font-medium text-texte-secondaire">{t('tableau.aucuneDonnee')}</span>
        ) : (
          <>
            <span className={`font-titre text-3xl font-bold ${classeValeur}`}>{valeur}</span>
            {unite !== undefined && unite !== '' && (
              <span className="text-base text-texte-secondaire">{unite}</span>
            )}
          </>
        )}
      </p>

      {valeur !== null && badge !== undefined && (
        <p className="mt-1">
          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${badge.classes}`}>
            {badge.texte}
          </span>
        </p>
      )}

      {variation !== undefined && <Variation variation={variation} />}

      {aide !== undefined && aide !== '' && <p className="mt-1 text-xs text-texte-secondaire">{aide}</p>}

      {lien !== undefined && <span className="sr-only">{t('tableau.cartes.voirAvis')}</span>}
    </>
  )

  if (lien !== undefined) {
    return (
      <Link to={lien} className={`${CLASSES_CARTE} transition-shadow hover:shadow-moyen`}>
        {contenu}
      </Link>
    )
  }

  return <div className={CLASSES_CARTE}>{contenu}</div>
}