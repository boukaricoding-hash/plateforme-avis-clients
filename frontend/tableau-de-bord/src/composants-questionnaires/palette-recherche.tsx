import { useMemo, useState } from 'react'
import type { ChangeEvent, KeyboardEvent, MouseEvent } from 'react'
import { IconeRecherche } from '../composants-avis/icones-avis'
import { utiliserLangue } from '../hooks/utiliser-langue'
import type { TexteMultilingue } from '../types/avis'
import type { ResumeQuestionnaire } from '../types/questionnaires'

// Palette de recherche de la page Questionnaires (ecran E10, jour 19), ouverte avec Ctrl K
// ou avec le bouton "Rechercher" de l'en-tete (comme la palette de la page Classes).
// Ce composant n'appelle pas l'API et ne connait pas le raccourci clavier : la page l'affiche
// quand la palette est ouverte, lui donne la liste et recoit le questionnaire choisi (onSelection)
// ou la demande de fermeture (onFermer).
// La recherche porte sur le titre francais et anglais, sans tenir compte des accents ni des majuscules.
// Fleches haut et bas pour parcourir, Entree pour choisir, Echap pour fermer.

// Nombre maximal de resultats affiches
const NOMBRE_MAX_RESULTATS = 8

// Texte d'un titre selon la langue : anglais si demande et rempli, sinon francais
function texteLangue(texte: TexteMultilingue, langue: string): string {
  if (langue === 'en' && texte.en !== undefined && texte.en !== null && texte.en.trim() !== '') {
    return texte.en
  }
  return texte.fr
}

// Minuscules et sans accents, pour comparer "Accueil" et "accueil"
function normaliser(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

type Proprietes = {
  questionnaires: ResumeQuestionnaire[]
  onFermer: () => void
  onSelection: (questionnaire: ResumeQuestionnaire) => void
}

export function PaletteRecherche({ questionnaires, onFermer, onSelection }: Proprietes) {
  const { t, langue } = utiliserLangue()
  const [recherche, setRecherche] = useState('')
  const [indexActif, setIndexActif] = useState(0)

  const resultats = useMemo(() => {
    const requete = normaliser(recherche.trim())
    const liste =
      requete === ''
        ? questionnaires
        : questionnaires.filter((questionnaire) => {
            const titres = `${questionnaire.titre.fr} ${questionnaire.titre.en ?? ''}`
            return normaliser(titres).includes(requete)
          })
    return liste.slice(0, NOMBRE_MAX_RESULTATS)
  }, [questionnaires, recherche])

  // L'index peut depasser la liste apres une recherche : on le ramene sur le dernier resultat
  const indexValide = Math.min(indexActif, Math.max(resultats.length - 1, 0))

  function gererChangement(evenement: ChangeEvent<HTMLInputElement>): void {
    setRecherche(evenement.target.value)
    setIndexActif(0)
  }

  function gererClicFond(evenement: MouseEvent<HTMLDivElement>): void {
    if (evenement.target === evenement.currentTarget) {
      onFermer()
    }
  }

  function gererTouche(evenement: KeyboardEvent<HTMLInputElement>): void {
    if (evenement.key === 'Escape') {
      onFermer()
    } else if (evenement.key === 'ArrowDown') {
      evenement.preventDefault()
      setIndexActif(Math.min(indexValide + 1, resultats.length - 1))
    } else if (evenement.key === 'ArrowUp') {
      evenement.preventDefault()
      setIndexActif(Math.max(indexValide - 1, 0))
    } else if (evenement.key === 'Enter' && resultats.length > 0) {
      evenement.preventDefault()
      onSelection(resultats[indexValide])
    }
  }

  return (
    <div className="questionnaires-palette-overlay" onMouseDown={gererClicFond}>
      <div
        className="questionnaires-palette-modale"
        role="dialog"
        aria-modal="true"
        aria-label={t('questionnaires.page.palette.titre')}
      >
        <div className="questionnaires-palette-champ-conteneur">
          <IconeRecherche className="questionnaires-palette-icone-svg" />
          <input
            type="text"
            className="questionnaires-palette-champ"
            placeholder={t('questionnaires.page.palette.placeholder')}
            aria-label={t('questionnaires.page.palette.placeholder')}
            value={recherche}
            onChange={gererChangement}
            onKeyDown={gererTouche}
            autoFocus
          />
          <kbd className="questionnaires-palette-touche">{t('questionnaires.page.palette.echap')}</kbd>
        </div>

        <div className="questionnaires-palette-liste" role="listbox">
          {resultats.length === 0 ? (
            <div className="questionnaires-palette-vide">
              {t('questionnaires.page.palette.aucun', { recherche })}
            </div>
          ) : (
            resultats.map((questionnaire, i) => {
              const titreBrut = texteLangue(questionnaire.titre, langue).trim()
              const titre = titreBrut !== '' ? titreBrut : t('questionnaires.liste.sansTitre')
              const version =
                questionnaire.version !== null
                  ? t('questionnaires.liste.version', { numero: questionnaire.version.numero })
                  : t('questionnaires.liste.aucuneVersion')
              const actif = i === indexValide
              return (
                <button
                  type="button"
                  role="option"
                  aria-selected={actif}
                  key={questionnaire.id}
                  className={`questionnaires-palette-item${actif ? ' questionnaires-palette-item--actif' : ''}`}
                  onMouseEnter={() => setIndexActif(i)}
                  onClick={() => onSelection(questionnaire)}
                >
                  <span
                    className={`questionnaires-palette-item-pastille questionnaires-palette-item-pastille--${questionnaire.statut.toLowerCase()}`}
                  />
                  <span className="questionnaires-palette-item-nom">{titre}</span>
                  <span className="questionnaires-palette-item-meta">
                    {t(`questionnaires.statuts.${questionnaire.statut}`)} · {version}
                  </span>
                </button>
              )
            })
          )}
        </div>

        <div className="questionnaires-palette-astuce">
          <kbd>↵</kbd> {t('questionnaires.page.palette.pourSelectionner')} · <kbd>{t('questionnaires.page.palette.echap')}</kbd>{' '}
          {t('questionnaires.page.palette.pourFermer')}
        </div>
      </div>
    </div>
  )
}