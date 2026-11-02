import { useCallback, useState } from 'react'
import { Outlet } from 'react-router'
import { BarreHaut } from './barre-haut'
import { MenuLateral } from './menu-lateral'

const CLE_STOCKAGE_MENU = 'tableau-de-bord.menu-replie'

// Menu replie ou deplie au depart : le choix deja fait sur cet appareil, sinon deplie.
function menuReplieDeDepart(): boolean {
  try {
    return window.localStorage.getItem(CLE_STOCKAGE_MENU) === 'oui'
  } catch {
    // Stockage indisponible : le menu demarre deplie.
    return false
  }
}

// Cadre commun de tous les ecrans connectes : menu a gauche, barre en haut, ecran au centre.
// Adapte a l'ordinateur (menu toujours visible, replie ou deplie), a la tablette et au telephone (menu en tiroir).
export function CadreApplication() {
  const [menuOuvert, setMenuOuvert] = useState(false)
  const [menuReplie, setMenuReplie] = useState<boolean>(menuReplieDeDepart)
  const ouvrirMenu = useCallback(() => setMenuOuvert(true), [])
  const fermerMenu = useCallback(() => setMenuOuvert(false), [])

  const basculerReplie = useCallback(() => {
    const suivant = !menuReplie
    setMenuReplie(suivant)
    try {
      window.localStorage.setItem(CLE_STOCKAGE_MENU, suivant ? 'oui' : 'non')
    } catch {
      // Sans stockage, le choix vaut seulement pour cette visite.
    }
  }, [menuReplie])

  return (
    <div className="flex h-screen overflow-hidden bg-fond">
      <MenuLateral
        ouvert={menuOuvert}
        onFermer={fermerMenu}
        replie={menuReplie}
        onBasculerReplie={basculerReplie}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <BarreHaut onOuvrirMenu={ouvrirMenu} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}