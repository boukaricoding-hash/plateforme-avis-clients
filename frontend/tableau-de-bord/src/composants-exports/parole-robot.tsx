import { useState } from 'react'
import { utiliserLangue } from '../hooks/utiliser-langue'
import type { EtatOperation, HumeurRobot, ReponseAnalyse } from '../types/exports'

// Ce que dit le robot, juste sous lui (jour 21, fichier 4 sur 9 du design) :
// - une phrase courte selon son humeur (je t'ecoute, je reflechis, c'est pret...) ;
// - quand l'analyse des avis est prete, une conclusion a la fois, sous la phrase :
//   le resume, puis les points faibles, les points forts et les pistes d'action.
//   Un clic sur la conclusion passe a la suivante. Les memes conclusions sont ecrites
//   dans le rapport PDF et dans la feuille Analyse d'Excel.
// Pendant qu'on tape ou que le robot reflechit, seule la phrase s'affiche : l'analyse
// n'est pas a jour. Le composant ne calcule rien et ne charge rien : tout vient du hook
// utiliserExport. Les textes des conclusions sont deja dans la langue demandee (ils viennent
// du serveur), les autres textes viennent des traductions.
// Style : classes exports-parole, exports-parole-texte, exports-parole-suite de styles/exports.css
// (le fichier est charge par la barre de recherche). Aucun cadre, aucune bordure.
// Textes : cles exports.robot.* (fichiers 6 et 7) : humeur.*, conclusion.fort, conclusion.faible,
// conclusion.piste, suivant, peuDAvis et erreurAnalyse.
// Le texte est annonce par les lecteurs d'ecran a chaque changement (aria-live).

type PropsParoleRobot = {
  humeur: HumeurRobot
  analyse: ReponseAnalyse | null
  etatAnalyse: EtatOperation
}

type Conclusion = {
  cle: string
  // Petit mot devant le texte (Point faible, Point fort, Piste d'action) ; null pour le resume.
  etiquette: string | null
  texte: string
}

type FonctionTexte = (cle: string, valeurs?: Record<string, string | number>) => string

// Humeurs ou la conclusion est a jour et peut etre lue.
const HUMEURS_AVEC_CONCLUSION: readonly HumeurRobot[] = ['repos', 'content', 'inquiet']

// Les conclusions, dans l'ordre ou le robot les dit : ce dont l'entreprise a besoin d'abord.
function listerConclusions(analyse: ReponseAnalyse, t: FonctionTexte): Conclusion[] {
  const conclusions: Conclusion[] = []

  if (analyse.resume.trim() !== '') {
    conclusions.push({ cle: 'resume', etiquette: null, texte: analyse.resume })
  }
  for (const point of analyse.points_faibles) {
    conclusions.push({
      cle: `faible-${point.code}`,
      etiquette: t('exports.robot.conclusion.faible'),
      texte: `${point.titre} — ${point.detail}`,
    })
  }
  for (const point of analyse.points_forts) {
    conclusions.push({
      cle: `fort-${point.code}`,
      etiquette: t('exports.robot.conclusion.fort'),
      texte: `${point.titre} — ${point.detail}`,
    })
  }
  for (const point of analyse.pistes) {
    conclusions.push({
      cle: `piste-${point.code}`,
      etiquette: t('exports.robot.conclusion.piste'),
      texte: `${point.titre} — ${point.detail}`,
    })
  }
  return conclusions
}

export function ParoleRobot({ humeur, analyse, etatAnalyse }: PropsParoleRobot) {
  const { t } = utiliserLangue()

  // Position de la conclusion lue. Elle repart de la premiere des qu'une nouvelle analyse arrive :
  // on garde l'analyse a laquelle la position se rapporte, sans effet ni remise a zero a la main.
  const [suivi, setSuivi] = useState<{ source: ReponseAnalyse | null; position: number }>({
    source: analyse,
    position: 0,
  })

  const lire = HUMEURS_AVEC_CONCLUSION.includes(humeur)
  const conclusions = analyse !== null && analyse.suffisant ? listerConclusions(analyse, t) : []
  const position = suivi.source === analyse && conclusions.length > 0 ? suivi.position % conclusions.length : 0
  const conclusion = conclusions.length > 0 ? conclusions[position] : null

  function passerALaSuivante(): void {
    setSuivi({ source: analyse, position: position + 1 })
  }

  let suite = null
  if (lire) {
    if (analyse !== null && !analyse.suffisant) {
      suite = <p className="exports-parole-suite">{t('exports.robot.peuDAvis', { nombre: analyse.nb_avis })}</p>
    } else if (conclusion !== null) {
      suite = (
        <button
          key={conclusion.cle}
          type="button"
          onClick={passerALaSuivante}
          aria-label={`${conclusion.texte}. ${t('exports.robot.suivant')}`}
          className="exports-parole-suite cursor-pointer rounded-md border-0 bg-transparent p-1 hover:text-texte"
        >
          {conclusion.etiquette !== null && (
            <span className="font-semibold text-texte">{`${conclusion.etiquette} : `}</span>
          )}
          <span className="line-clamp-3">{conclusion.texte}</span>
          {conclusions.length > 1 && (
            <span aria-hidden="true" className="ml-1 text-xs text-texte-discret">
              {`${position + 1}/${conclusions.length}`}
            </span>
          )}
        </button>
      )
    } else if (etatAnalyse === 'erreur') {
      suite = <p className="exports-parole-suite">{t('exports.robot.erreurAnalyse')}</p>
    }
  }

  // La cle relance le petit fondu a chaque changement d'humeur.
  return (
    <div key={humeur} aria-live="polite" className="exports-parole">
      <p className="exports-parole-texte">{t(`exports.robot.humeur.${humeur}`)}</p>
      {suite}
    </div>
  )
}