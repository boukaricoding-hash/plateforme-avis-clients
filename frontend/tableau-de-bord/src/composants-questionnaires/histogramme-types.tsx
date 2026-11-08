import { useEffect, useMemo, useState } from 'react'
import { utiliserLangue } from '../hooks/utiliser-langue'
import type { QuestionQuestionnaire } from '../types/questionnaires'
import type { TypeQuestion } from '../types/tableau-de-bord'
import { iconesParType } from './icones-questionnaires'

// Histogramme des types de questions du questionnaire selectionne (ecran E10, jour 19),
// dans la colonne de droite, sous le panneau de detail (comme le graphe des effectifs de la page Classes).
// Ce composant n'appelle pas l'API : les questions viennent de la fiche deja chargee par la page.
// Seuls les types presents sont affiches, du plus frequent au moins frequent.
// Les barres grandissent a l'affichage et a chaque changement de questionnaire.

// Les 8 types, pris dans la table des icones pour n'en oublier aucun
const TYPES = Object.keys(iconesParType) as TypeQuestion[]

type LigneType = {
  type: TypeQuestion
  nombre: number
}

// Compte les questions par type ; a egalite, l'ordre de la table des icones est garde
function compterTypes(questions: QuestionQuestionnaire[]): LigneType[] {
  return TYPES.map((type) => ({ type, nombre: questions.filter((question) => question.type === type).length }))
    .filter((ligne) => ligne.nombre > 0)
    .sort((a, b) => b.nombre - a.nombre)
}

// Les barres : ce composant est recree (key) a chaque changement de donnees,
// donc il repart de barres vides et les fait grandir.
function Barres({ lignes }: { lignes: LigneType[] }) {
  const { t } = utiliserLangue()
  const [dessine, setDessine] = useState(false)

  useEffect(() => {
    // Deux images d'attente : le navigateur affiche d'abord les barres vides, puis la transition demarre
    let image = requestAnimationFrame(() => {
      image = requestAnimationFrame(() => setDessine(true))
    })
    return () => cancelAnimationFrame(image)
  }, [])

  const maximum = Math.max(...lignes.map((ligne) => ligne.nombre), 1)

  return (
    <ul className="questionnaires-histo-liste">
      {lignes.map((ligne, i) => {
        const Icone = iconesParType[ligne.type]
        const largeur = dessine ? (ligne.nombre / maximum) * 100 : 0
        return (
          <li key={ligne.type} className="questionnaires-histo-ligne">
            <span className="questionnaires-histo-type">
              <Icone className="questionnaires-histo-icone-svg" />
              <span className="questionnaires-histo-nom">{t(`questionnaires.page.typesCourts.${ligne.type}`)}</span>
            </span>
            <span className="questionnaires-histo-piste" aria-hidden="true">
              <span
                className="questionnaires-histo-barre"
                style={{ width: `${largeur}%`, transitionDelay: `${0.1 + i * 0.08}s` }}
              />
            </span>
            <span className="questionnaires-histo-valeur">{ligne.nombre}</span>
          </li>
        )
      })}
    </ul>
  )
}

// Squelette affiche pendant le chargement de la fiche
function SqueletteHistogramme() {
  return (
    <div className="questionnaires-histo-squelette" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="questionnaires-squelette-ligne"
          style={{ height: 14, width: `${90 - i * 14}%`, animationDelay: `${i * 0.07}s` }}
        />
      ))}
    </div>
  )
}

export function HistogrammeTypes({
  questions,
  chargement,
}: {
  // Questions du questionnaire selectionne ; liste vide = questionnaire sans question.
  questions: QuestionQuestionnaire[]
  // Vrai tant que la fiche n'est pas chargee.
  chargement: boolean
}) {
  const { t } = utiliserLangue()

  const lignes = useMemo(() => compterTypes(questions), [questions])
  // Change quand la repartition change : sert de cle pour rejouer l'animation
  const signature = lignes.map((ligne) => `${ligne.type}:${ligne.nombre}`).join('|')

  return (
    <div className="questionnaires-histo">
      <div className="questionnaires-histo-entete">
        <span className="questionnaires-histo-titre">{t('questionnaires.page.histogramme.titre')}</span>
        {!chargement && lignes.length > 0 && (
          <div className="questionnaires-histo-soustitre">
            {t('questionnaires.page.histogramme.sousTitre', { nombre: questions.length })}
          </div>
        )}
      </div>

      {chargement && <SqueletteHistogramme />}
      {!chargement && lignes.length === 0 && (
        <div className="questionnaires-histo-etat">{t('questionnaires.page.histogramme.vide')}</div>
      )}
      {!chargement && lignes.length > 0 && <Barres key={signature} lignes={lignes} />}
    </div>
  )
}