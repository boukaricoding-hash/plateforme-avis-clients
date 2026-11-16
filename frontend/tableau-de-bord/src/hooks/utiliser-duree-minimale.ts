import { useEffect, useState } from 'react'

// Les trois moments du loader :
// - chargement : le battement et le D se dessinent
// - sortie : le loader s'efface en fondu (meme duree que chargement-ecran--sortie dans chargement.css)
// - termine : le loader a disparu, la page peut s'afficher
export type PhaseChargement = 'chargement' | 'sortie' | 'termine'

const DUREE_MINIMALE_MS = 2500
const DUREE_SORTIE_MS = 400

// Garde le loader affiche au moins dureeMinimaleMs, meme si la page est prete plus vite,
// pour que le D ait le temps de se dessiner en entier. Si la page est prete plus tard,
// le loader reste jusqu'a ce qu'elle le soit.
//
// pret : true quand la verification de la session est finie.
// Le loader ne joue qu'une fois : si on arrive deja pret (par exemple juste apres la connexion,
// quand le cadre se remonte), la phase est tout de suite "termine".
export function utiliserDureeMinimale(
  pret: boolean,
  dureeMinimaleMs: number = DUREE_MINIMALE_MS,
  dureeSortieMs: number = DUREE_SORTIE_MS,
): PhaseChargement {
  const [avecLoader] = useState(!pret)
  const [minimumAtteint, setMinimumAtteint] = useState(!avecLoader)
  const [sortieFinie, setSortieFinie] = useState(!avecLoader)

  // Premier minuteur : la duree minimale d'affichage
  useEffect(() => {
    if (!avecLoader) {
      return undefined
    }
    const minuteur = window.setTimeout(() => setMinimumAtteint(true), dureeMinimaleMs)
    return () => window.clearTimeout(minuteur)
  }, [avecLoader, dureeMinimaleMs])

  // La sortie commence quand le minimum est atteint ET que la page est prete
  const enSortie = minimumAtteint && pret && !sortieFinie

  // Second minuteur : la duree du fondu de sortie
  useEffect(() => {
    if (!enSortie) {
      return undefined
    }
    const minuteur = window.setTimeout(() => setSortieFinie(true), dureeSortieMs)
    return () => window.clearTimeout(minuteur)
  }, [enSortie, dureeSortieMs])

  if (sortieFinie) {
    return 'termine'
  }
  return enSortie ? 'sortie' : 'chargement'
}