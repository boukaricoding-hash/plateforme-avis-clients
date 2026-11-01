import { utiliserLangue } from '../hooks/utiliser-langue'

// Pagination des listes de l'accueil (classement, avis recents, questions) :
// fleches, points et "Page 1 sur 3", dans le meme style que les groupes de cartes.
// Au-dela de ce nombre de pages, on garde seulement les fleches et le texte (trop de points sinon).
const NB_POINTS_MAX = 7

type Proprietes = {
  // Numero de la page affichee, a partir de 0
  pageCourante: number
  nbPages: number
  onAller: (page: number) => void
}

export function Pagination({ pageCourante, nbPages, onAller }: Proprietes) {
  const { t } = utiliserLangue()

  // Une seule page : rien a afficher
  if (nbPages <= 1) {
    return null
  }

  const texte = t('tableau.accueil.pageSur', { numero: pageCourante + 1, total: nbPages })
  const premierePage = pageCourante === 0
  const dernierePage = pageCourante === nbPages - 1

  return (
    <nav className="accueil-pagination" aria-label={texte}>
      <button
        type="button"
        className="accueil-fleche"
        onClick={() => onAller(pageCourante - 1)}
        disabled={premierePage}
        aria-label={t('tableau.accueil.pagePrecedente')}
      >
        ←
      </button>

      {nbPages <= NB_POINTS_MAX && (
        <div className="accueil-points">
          {Array.from({ length: nbPages }, (_, index) => (
            <button
              key={index}
              type="button"
              className={`accueil-point ${index === pageCourante ? 'accueil-point--actif' : ''}`}
              aria-label={t('tableau.accueil.pageAller', { numero: index + 1 })}
              aria-current={index === pageCourante ? 'page' : undefined}
              onClick={() => onAller(index)}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        className="accueil-fleche"
        onClick={() => onAller(pageCourante + 1)}
        disabled={dernierePage}
        aria-label={t('tableau.accueil.pageSuivante')}
      >
        →
      </button>

      <span className="accueil-pagination-texte" aria-live="polite">
        {texte}
      </span>
    </nav>
  )
}