import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

// Un objet qui ne contient que des nombres, eventuellement imbriques
// (c'est la forme de ParametresHumeur dans humeurs.ts).
export type Nombres = { [cle: string]: number | Nombres }

// Met tous les nombres d'un objet a plat, dans l'ordre des cles.
function aplatir(objet: Nombres, sortie: number[] = []): number[] {
  for (const [, valeur] of Object.entries(objet)) {
    if (typeof valeur === 'number') {
      sortie.push(valeur)
    } else {
      aplatir(valeur, sortie)
    }
  }
  return sortie
}

// Refait un objet de meme forme que le modele, avec les valeurs donnees (meme ordre qu'aplatir).
function reconstruire<T extends Nombres>(modele: T, valeurs: number[], index = { i: 0 }): T {
  const resultat: Nombres = {}
  for (const [cle, valeur] of Object.entries(modele)) {
    if (typeof valeur === 'number') {
      resultat[cle] = valeurs[index.i]
      index.i += 1
    } else {
      resultat[cle] = reconstruire(valeur, valeurs, index)
    }
  }
  return resultat as T
}

const REQUETE_ANIMATIONS_REDUITES = '(prefers-reduced-motion: reduce)'

function sAbonner(rappel: () => void): () => void {
  const media = window.matchMedia(REQUETE_ANIMATIONS_REDUITES)
  media.addEventListener('change', rappel)
  return () => media.removeEventListener('change', rappel)
}

// Vrai quand l'appareil demande moins d'animations (reglage d'accessibilite).
export function utiliserAnimationsReduites(): boolean {
  return useSyncExternalStore(
    sAbonner,
    () => window.matchMedia(REQUETE_ANIMATIONS_REDUITES).matches,
    () => false,
  )
}

// Pas de calcul fixe : le resultat ne depend pas de la vitesse du telephone.
const PAS = 1 / 120
// Ecart maximum entre deux images : evite un saut brutal quand l'onglet revient au premier plan.
const ECART_MAX = 1 / 30
// En dessous de ces seuils, on considere que le ressort est arrete.
const SEUIL_POSITION = 0.01
const SEUIL_VITESSE = 0.02

// Fait glisser tous les nombres de « cible » avec un ressort : ils partent de leur valeur
// actuelle, depassent un peu la cible, puis se stabilisent (rebond naturel).
// - raideur : plus grande = plus vif ;
// - amortissement : plus petit = plus de rebond.
// La cible doit garder la meme forme et rester la meme reference tant qu'elle ne change pas
// (par exemple une valeur de PARAMETRES_HUMEURS).
// Quand les animations sont reduites, on renvoie directement la cible, sans mouvement.
export function utiliserRessort<T extends Nombres>(
  cible: T,
  raideur = 170,
  amortissement = 14,
): T {
  const reduit = utiliserAnimationsReduites()
  const [courant, setCourant] = useState<T>(cible)
  // Position et vitesse de chaque nombre, conservees d'une humeur a l'autre :
  // si l'humeur change en plein mouvement, l'elan continue au lieu de repartir de zero.
  const etat = useRef<{ position: number[]; vitesse: number[] }>({ position: [], vitesse: [] })

  useEffect(() => {
    if (reduit) return

    const arrivee = aplatir(cible)
    const { position, vitesse } = etat.current
    if (position.length !== arrivee.length) {
      etat.current = { position: [...arrivee], vitesse: arrivee.map(() => 0) }
    }
    const pos = etat.current.position
    const vit = etat.current.vitesse

    let image = 0
    let precedent: number | null = null

    const boucle = (maintenant: number) => {
      const ecart = precedent === null ? 0 : Math.min((maintenant - precedent) / 1000, ECART_MAX)
      precedent = maintenant

      let reste = ecart
      while (reste > 0) {
        const h = Math.min(PAS, reste)
        for (let i = 0; i < arrivee.length; i += 1) {
          const force = raideur * (arrivee[i] - pos[i]) - amortissement * vit[i]
          vit[i] += force * h
          pos[i] += vit[i] * h
        }
        reste -= h
      }

      let arrete = true
      for (let i = 0; i < arrivee.length; i += 1) {
        if (Math.abs(arrivee[i] - pos[i]) > SEUIL_POSITION || Math.abs(vit[i]) > SEUIL_VITESSE) {
          arrete = false
          break
        }
      }

      if (arrete) {
        // Arrivee exacte, et on arrete de calculer.
        for (let i = 0; i < arrivee.length; i += 1) {
          pos[i] = arrivee[i]
          vit[i] = 0
        }
        setCourant(cible)
        return
      }

      setCourant(reconstruire(cible, pos))
      image = requestAnimationFrame(boucle)
    }

    image = requestAnimationFrame(boucle)
    return () => cancelAnimationFrame(image)
  }, [cible, raideur, amortissement, reduit])

  return reduit ? cible : courant
}