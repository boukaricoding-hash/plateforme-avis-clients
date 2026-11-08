import { useEffect, useMemo, useRef, useState } from 'react'
import type { ComposantIcone } from '../composants-tableau/icones-accueil'
import { utiliserLangue } from '../hooks/utiliser-langue'
import { IconeQuestionnaires } from '../mise-en-page/icones-menu'
import type { ResumeQuestionnaire } from '../types/questionnaires'
import { IconeModifier, IconeStatutActif, IconeStatutInactif } from './icones-questionnaires'

// Panneau de statistiques de la page Questionnaires (ecran E10, jour 19), en bas a gauche :
// 4 compteurs animes (total, actifs, brouillons, inactifs) et une jauge circulaire
// (part de questionnaires actifs).
// Ce composant n'appelle pas l'API : il compte les questionnaires que la page lui donne.
// Il contient aussi CompteurAnime (reutilise par le panneau de detail) et le squelette de chargement.

// Rayon de la jauge, dans une grille de 60 x 60
const RAYON_JAUGE = 24

function mouvementReduit(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// Affiche un nombre qui glisse vers sa nouvelle valeur quand elle change.
// Au premier affichage, la valeur est montree tout de suite (pas d'animation).
// Si la personne a demande moins de mouvement, la valeur change en un instant.
export function CompteurAnime({
  valeur,
  duree = 700,
  decimales = 0,
}: {
  valeur: number
  duree?: number
  decimales?: number
}) {
  const [affichee, setAffichee] = useState(valeur)
  // Derniere valeur montree : une animation interrompue repart de la ou elle en etait
  const departRef = useRef(valeur)

  useEffect(() => {
    const depart = departRef.current
    if (depart === valeur) {
      return
    }

    const dureeEffective = mouvementReduit() ? 1 : duree
    const debut = performance.now()
    let image = 0

    function etape(maintenant: number): void {
      const progression = Math.min(1, (maintenant - debut) / dureeEffective)
      const facilite = 1 - Math.pow(1 - progression, 3)
      const courante = depart + (valeur - depart) * facilite
      departRef.current = courante
      setAffichee(courante)
      if (progression < 1) {
        image = requestAnimationFrame(etape)
      }
    }

    image = requestAnimationFrame(etape)
    return () => cancelAnimationFrame(image)
  }, [valeur, duree])

  return <>{affichee.toFixed(decimales)}</>
}

function JaugeCirculaire({ pourcentage }: { pourcentage: number }) {
  const circonference = 2 * Math.PI * RAYON_JAUGE
  const valeur = Math.min(100, Math.max(0, pourcentage))
  const decalage = circonference - (valeur / 100) * circonference

  return (
    <div className="questionnaires-jauge">
      <svg viewBox="0 0 60 60" className="questionnaires-jauge-svg" aria-hidden="true" focusable="false">
        <circle cx="30" cy="30" r={RAYON_JAUGE} className="questionnaires-jauge-fond" strokeWidth="6" fill="none" />
        <circle
          cx="30"
          cy="30"
          r={RAYON_JAUGE}
          className="questionnaires-jauge-progression"
          strokeWidth="6"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circonference}
          strokeDashoffset={decalage}
          transform="rotate(-90 30 30)"
        />
      </svg>
      <span className="questionnaires-jauge-valeur">
        <CompteurAnime valeur={valeur} />%
      </span>
    </div>
  )
}

function Statistique({ Icone, valeur, titre }: { Icone: ComposantIcone; valeur: number; titre: string }) {
  return (
    <div className="questionnaires-stat">
      <div className="questionnaires-stat-icone">
        <Icone className="questionnaires-stat-icone-svg" />
      </div>
      <div className="questionnaires-stat-texte">
        <div className="questionnaires-stat-valeur">
          <CompteurAnime valeur={valeur} />
        </div>
        <div className="questionnaires-stat-titre">{titre}</div>
      </div>
    </div>
  )
}

export function PanneauStats({ questionnaires }: { questionnaires: ResumeQuestionnaire[] }) {
  const { t } = utiliserLangue()

  const stats = useMemo(() => {
    const total = questionnaires.length
    const actifs = questionnaires.filter((questionnaire) => questionnaire.statut === 'ACTIF').length
    const brouillons = questionnaires.filter((questionnaire) => questionnaire.statut === 'BROUILLON').length
    const inactifs = questionnaires.filter((questionnaire) => questionnaire.statut === 'INACTIF').length
    const partActifs = total === 0 ? 0 : (actifs / total) * 100
    return { total, actifs, brouillons, inactifs, partActifs }
  }, [questionnaires])

  return (
    <div className="questionnaires-panneau-bas">
      <Statistique Icone={IconeQuestionnaires} valeur={stats.total} titre={t('questionnaires.page.stats.total')} />
      <Statistique Icone={IconeStatutActif} valeur={stats.actifs} titre={t('questionnaires.page.stats.actifs')} />
      <Statistique Icone={IconeModifier} valeur={stats.brouillons} titre={t('questionnaires.page.stats.brouillons')} />
      <Statistique Icone={IconeStatutInactif} valeur={stats.inactifs} titre={t('questionnaires.page.stats.inactifs')} />

      <div className="questionnaires-stat questionnaires-stat--jauge">
        <JaugeCirculaire pourcentage={stats.partActifs} />
        <div className="questionnaires-stat-texte">
          <div className="questionnaires-stat-valeur">
            <CompteurAnime valeur={stats.partActifs} decimales={1} />%
          </div>
          <div className="questionnaires-stat-titre">{t('questionnaires.page.stats.partActifs')}</div>
          <div className="questionnaires-stat-souslabel">{t('questionnaires.page.stats.partActifsAide')}</div>
        </div>
      </div>
    </div>
  )
}

// Squelette affiche pendant le chargement de la liste (meme forme que le panneau)
export function SqueletteStats() {
  return (
    <div className="questionnaires-panneau-bas questionnaires-squelette-panneau-bas" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <div className="questionnaires-squelette-stat" key={i} style={{ animationDelay: `${i * 0.06}s` }}>
          <div className="questionnaires-squelette-cercle" />
          <div className="questionnaires-squelette-colonne">
            <div className="questionnaires-squelette-ligne" style={{ width: '70%', height: 16 }} />
            <div className="questionnaires-squelette-ligne" style={{ width: '90%', height: 10 }} />
          </div>
        </div>
      ))}
    </div>
  )
}