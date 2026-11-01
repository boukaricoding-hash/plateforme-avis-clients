import { useCallback, useState } from 'react'
import { Outlet } from 'react-router'
import { BarreHaut } from './barre-haut'
import { MenuLateral } from './menu-lateral'

// Cadre commun de tous les ecrans connectes : menu a gauche, barre en haut, ecran au centre.
// Adapte a l'ordinateur (menu toujours visible), a la tablette et au telephone (menu en tiroir).
export function CadreApplication() {
  const [menuOuvert, setMenuOuvert] = useState(false)
  const ouvrirMenu = useCallback(() => setMenuOuvert(true), [])
  const fermerMenu = useCallback(() => setMenuOuvert(false), [])

  return (
    <div className="flex h-screen overflow-hidden bg-fond">
      <MenuLateral ouvert={menuOuvert} onFermer={fermerMenu} />

      <div className="flex min-w-0 flex-1 flex-col">
        <BarreHaut onOuvrirMenu={ouvrirMenu} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}