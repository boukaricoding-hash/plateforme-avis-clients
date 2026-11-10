import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { IconeAjouter } from './icones-questionnaires'

// Carrousel de l'editeur de questionnaire (ecran E10, jour 20, design).
// Il remplace la longue page verticale : une seule slide est visible a la fois, dans une zone
// qui prend toute la hauteur disponible, et la page ne defile plus.
// Slides, dans l'ordre : General, une par question, puis (questionnaire deja cree) Publication
// et Versions. En bas : un point numerote par slide et un bouton + juste apres la derniere
// question, pour en ajouter une.
// Ce composant ne connait ni l'API ni le brouillon : la page lui donne les slides deja pretes
// (contenu, texte du point, texte lu par les lecteurs d'ecran) et l'action du bouton +.
// Toutes les slides restent montees (les inactives sont seulement cachees), pour que ce qui est
// en cours de saisie dans une slide ne soit jamais perdu quand on change de slide.
// La slide affichee suit les changements de la liste :
// - question ajoutee ou dupliquee : on va sur la nouvelle question ;
// - question supprimee : on va sur la question qui prend sa place, sinon sur la precedente ;
// - question deplacee : la slide affichee reste la meme question.

export type GenreDiapositive = 'general' | 'question' | 'autre'

export type Diapositive = {
  // Identifiant stable (la cle de la question pour une question)
  cle: string
  // Texte du point : un numero ou un mot court
  etiquette: string
  // Texte lu par les lecteurs d'ecran, et infobulle du point
  libelle: string
  genre: GenreDiapositive
  contenu: ReactNode
}

type PropsCarrouselEditeur = {
  diapositives: Diapositive[]
  // Texte lu pour la barre des points (nom de la navigation entre les slides)
  libelleNavigation: string
  // Texte du bouton + (infobulle et lecteurs d'ecran)
  libelleAjouter: string
  onAjouter: () => void
  ajoutDesactive: boolean
  // Petit texte sous les points (ex. la limite de questions atteinte) ; null = rien
  indication: string | null
}

export function CarrouselEditeur({
  diapositives,
  libelleNavigation,
  libelleAjouter,
  onAjouter,
  ajoutDesactive,
  indication,
}: PropsCarrouselEditeur) {
  const cles = diapositives.map((diapositive) => diapositive.cle)
  const [actif, setActif] = useState(cles[0] ?? '')
  const [clesPrecedentes, setClesPrecedentes] = useState(cles)
  const listeRef = useRef<HTMLUListElement | null>(null)

  // La liste a change : on choisit la slide a afficher (ajustement pendant l'affichage,
  // sans effet, pour qu'aucune image avec une slide qui n'existe plus ne soit dessinee)
  if (clesPrecedentes.join('|') !== cles.join('|')) {
    setClesPrecedentes(cles)
    const ajoutees = diapositives.filter(
      (diapositive) => diapositive.genre === 'question' && !clesPrecedentes.includes(diapositive.cle),
    )
    if (ajoutees.length > 0) {
      setActif(ajoutees[ajoutees.length - 1].cle)
    } else if (!cles.includes(actif)) {
      const ancienneIndice = clesPrecedentes.indexOf(actif)
      const candidate = ancienneIndice >= 0 ? diapositives[ancienneIndice] : undefined
      if (candidate !== undefined && candidate.genre === 'question') {
        setActif(candidate.cle)
      } else {
        setActif(cles[Math.max(ancienneIndice - 1, 0)] ?? cles[0] ?? '')
      }
    }
  }

  // Le point actif reste visible quand il y a beaucoup de slides (la barre defile de cote)
  useEffect(() => {
    const point = listeRef.current?.querySelector('[aria-current="step"]')
    point?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [actif])

  if (diapositives.length === 0) {
    return null
  }

  // Le bouton + vient juste apres le dernier point "General" ou "question"
  let indiceAjout = -1
  diapositives.forEach((diapositive, indice) => {
    if (diapositive.genre !== 'autre') {
      indiceAjout = indice
    }
  })

  return (
    <div className="carrousel-editeur">
      <div className="carrousel-editeur-scene">
        {diapositives.map((diapositive) => (
          <section
            key={diapositive.cle}
            className="carrousel-editeur-diapo"
            aria-label={diapositive.libelle}
            hidden={diapositive.cle !== actif}
          >
            <div className="carrousel-editeur-contenu">{diapositive.contenu}</div>
          </section>
        ))}
      </div>

      <nav className="carrousel-editeur-navigation" aria-label={libelleNavigation}>
        <ul className="carrousel-editeur-points" ref={listeRef}>
          {diapositives.map((diapositive, indice) => {
            const estActif = diapositive.cle === actif
            return (
              <li key={diapositive.cle} className="carrousel-editeur-element">
                <button
                  type="button"
                  className={
                    estActif
                      ? 'carrousel-editeur-point carrousel-editeur-point--actif'
                      : 'carrousel-editeur-point'
                  }
                  aria-current={estActif ? 'step' : undefined}
                  aria-label={diapositive.libelle}
                  title={diapositive.libelle}
                  onClick={() => setActif(diapositive.cle)}
                >
                  {diapositive.etiquette}
                </button>
                {indice === indiceAjout && (
                  <button
                    type="button"
                    className="carrousel-editeur-ajouter"
                    aria-label={libelleAjouter}
                    title={libelleAjouter}
                    disabled={ajoutDesactive}
                    onClick={onAjouter}
                  >
                    <IconeAjouter />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
        {indication !== null && <p className="carrousel-editeur-indication">{indication}</p>}
      </nav>
    </div>
  )
}