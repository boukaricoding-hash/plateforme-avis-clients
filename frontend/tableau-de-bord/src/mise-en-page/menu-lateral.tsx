import { useEffect } from 'react'
import { NavLink } from 'react-router'
import { utiliserLangue } from '../hooks/utiliser-langue'

type Entree = {
  chemin: string
  cle: string
  // Dessin de l'icone (trace SVG sur une grille de 24 x 24).
  icone: string
}

// Tous les ecrans du tableau de bord. Les ecrans pas encore construits affichent
// un message "bientot disponible" jusqu'au jour de leur construction.
const ENTREES: Entree[] = [
  { chemin: '/', cle: 'menu.tableauDeBord', icone: 'M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z' },
  { chemin: '/avis', cle: 'menu.avis', icone: 'M21 6h-2v9H6v2c0 .55.45 1 1 1h11l4 4V7c0-.55-.45-1-1-1Zm-4 6V3c0-.55-.45-1-1-1H3c-.55 0-1 .45-1 1v14l4-4h10c.55 0 1-.45 1-1Z' },
  { chemin: '/questionnaires', cle: 'menu.questionnaires', icone: 'M19 3h-4.18C14.4 1.84 13.3 1 12 1s-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2Zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1Zm2 14H7v-2h7v2Zm3-4H7v-2h10v2Zm0-4H7V7h10v2Z' },
  { chemin: '/qr-codes', cle: 'menu.qrCodes', icone: 'M3 11h8V3H3v8Zm2-6h4v4H5V5Zm-2 16h8v-8H3v8Zm2-6h4v4H5v-4Zm8-12v8h8V3h-8Zm6 6h-4V5h4v4Zm0 10h2v2h-2v-2Zm-6-6h2v2h-2v-2Zm2 2h2v2h-2v-2Zm-2 2h2v2h-2v-2Zm2 2h2v2h-2v-2Zm2-2h2v2h-2v-2Zm0-4h2v2h-2v-2Zm2 2h2v2h-2v-2Z' },
  { chemin: '/sites', cle: 'menu.sites', icone: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7Zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5Z' },
  { chemin: '/utilisateurs', cle: 'menu.utilisateurs', icone: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3Zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3Zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13Zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5Z' },
  { chemin: '/exports', cle: 'menu.exports', icone: 'M19 9h-4V3H9v6H5l7 7 7-7ZM5 18v2h14v-2H5Z' },
  { chemin: '/parametres', cle: 'menu.parametres', icone: 'M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.61-.22l-2.39.96a7.03 7.03 0 0 0-1.62-.94l-.36-2.54a.48.48 0 0 0-.48-.41h-3.84a.48.48 0 0 0-.48.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 0 0-.61.22L2.74 8.84a.48.48 0 0 0 .12.64l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.12.22.37.29.61.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.48-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.49 0 .61-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.01-1.58ZM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2Z' },
]

type Proprietes = {
  // Tiroir ouvert (tablette et telephone seulement : sur ordinateur le menu est toujours visible).
  ouvert: boolean
  onFermer: () => void
}

export function MenuLateral({ ouvert, onFermer }: Proprietes) {
  const { t } = utiliserLangue()

  // La touche Echap ferme le tiroir.
  useEffect(() => {
    if (!ouvert) {
      return
    }
    function surTouche(evenement: KeyboardEvent) {
      if (evenement.key === 'Escape') {
        onFermer()
      }
    }
    window.addEventListener('keydown', surTouche)
    return () => window.removeEventListener('keydown', surTouche)
  }, [ouvert, onFermer])

  return (
    <>
      {/* Voile derriere le tiroir ouvert (tablette et telephone) */}
      {ouvert && (
        <button
          type="button"
          aria-label={t('menu.fermer')}
          onClick={onFermer}
          className="fixed inset-0 z-30 bg-texte/40 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-bordure bg-surface transition-transform duration-200 motion-reduce:transition-none lg:static lg:translate-x-0 ${
          ouvert ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 shrink-0 flex-col justify-center border-b border-bordure px-5">
          <span className="font-titre text-lg font-bold leading-tight text-texte">
            {t('marque.produit')}
          </span>
          <span className="text-xs text-texte-secondaire">{t('marque.fournisseur')}</span>
        </div>

        <nav aria-label={t('menu.navigation')} className="flex-1 overflow-y-auto p-3">
          <ul className="flex flex-col gap-1">
            {ENTREES.map((entree) => (
              <li key={entree.chemin}>
                <NavLink
                  to={entree.chemin}
                  end={entree.chemin === '/'}
                  onClick={onFermer}
                  className={({ isActive }) =>
                    `flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-principale text-texte-sur-principale'
                        : 'text-texte hover:bg-fond-alt'
                    }`
                  }
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="20"
                    height="20"
                    fill="currentColor"
                    aria-hidden="true"
                    className="shrink-0"
                  >
                    <path d={entree.icone} />
                  </svg>
                  {t(entree.cle)}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </>
  )
}