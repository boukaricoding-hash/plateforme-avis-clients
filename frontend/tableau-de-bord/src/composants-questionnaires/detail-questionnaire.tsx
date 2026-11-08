import { useEffect, useRef, useState } from 'react'
import { IconeEpingle } from '../composants-avis/icones-avis'
import { IconeQuestions } from '../composants-tableau/icones-accueil'
import { utiliserLangue } from '../hooks/utiliser-langue'
import type { TexteMultilingue } from '../types/avis'
import type { FicheQuestionnaire } from '../types/questionnaires'
import { CompteurAnime } from './panneau-stats'
import {
  IconeAttention,
  IconeDupliquer,
  IconeModifier,
  IconeVideSelection,
  iconesParType,
} from './icones-questionnaires'

// Panneau de detail de la page Questionnaires (ecran E10, jour 19), en haut de la colonne de droite
// (comme le panneau de detail de la page Classes) : onglets Apercu / Informations / Questions
// et menu ... (modifier, dupliquer).
// Ce composant n'appelle pas l'API : la page lui donne la fiche deja chargee, l'etat de chargement
// et les actions. Le menu n'est affiche que pour le Responsable (le Gestionnaire est en lecture seule).
// L'histogramme des types de questions est un composant a part, place sous ce panneau par la page.

type Onglet = 'apercu' | 'informations' | 'questions'

const ONGLETS: Onglet[] = ['apercu', 'informations', 'questions']

// Texte d'un libelle selon la langue : anglais si demande et rempli, sinon francais
function texteLangue(texte: TexteMultilingue, langue: string): string {
  if (langue === 'en' && texte.en !== undefined && texte.en !== null && texte.en.trim() !== '') {
    return texte.en
  }
  return texte.fr
}

// Date lisible dans la langue choisie ; un tiret si la date n'est pas valide
function formaterDate(valeur: string, langue: string): string {
  const date = new Date(valeur)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }
  return new Intl.DateTimeFormat(langue === 'en' ? 'en-GB' : 'fr-FR', { dateStyle: 'medium' }).format(date)
}

// Courbe decorative de la carte "part de reponses obligatoires"
function VagueDecorative() {
  return (
    <svg
      className="questionnaires-detail-vague-svg"
      viewBox="0 0 160 40"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M0 28C10 28 10 12 20 12C30 12 30 32 40 32C50 32 50 8 60 8C70 8 70 26 80 26C90 26 90 14 100 14C110 14 110 30 120 30C130 30 130 10 140 10C150 10 150 22 160 22"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  )
}

// Squelette affiche pendant le chargement de la fiche (meme forme que le panneau)
function SqueletteDetail({ libelle }: { libelle: string }) {
  return (
    <div className="questionnaires-detail questionnaires-detail--squelette" role="status" aria-label={libelle}>
      <div aria-hidden="true" className="questionnaires-detail-squelette-contenu">
        <div className="questionnaires-squelette-ligne" style={{ width: '40%', height: 10 }} />
        <div className="questionnaires-detail-identite">
          <div className="questionnaires-squelette-cercle" style={{ width: 48, height: 48 }} />
          <div className="questionnaires-squelette-colonne" style={{ flex: 1 }}>
            <div className="questionnaires-squelette-ligne" style={{ width: '55%', height: 18 }} />
            <div className="questionnaires-squelette-ligne" style={{ width: '75%', height: 12 }} />
          </div>
        </div>
        <div className="questionnaires-detail-grille">
          <div className="questionnaires-squelette-carte" />
          <div className="questionnaires-squelette-carte" />
          <div className="questionnaires-squelette-carte" />
          <div className="questionnaires-squelette-carte" />
        </div>
      </div>
    </div>
  )
}

type ProprietesContenu = {
  fiche: FicheQuestionnaire
  peutModifier: boolean
  duplicationEnCours: boolean
  onModifier: (id: string) => void
  onDupliquer: (id: string) => void
}

// Contenu du panneau pour une fiche chargee.
// La page le recree (key = id de la fiche) a chaque changement de questionnaire :
// l'onglet repart sur Apercu et le menu se ferme sans code supplementaire.
function ContenuDetail({ fiche, peutModifier, duplicationEnCours, onModifier, onDupliquer }: ProprietesContenu) {
  const { t, langue } = utiliserLangue()
  const [onglet, setOnglet] = useState<Onglet>('apercu')
  const [menuOuvert, setMenuOuvert] = useState(false)
  const refMenu = useRef<HTMLDivElement>(null)

  // Ferme le menu au clic a l'exterieur et avec la touche Echap
  useEffect(() => {
    if (!menuOuvert) {
      return
    }

    function gererClicExterieur(evenement: MouseEvent): void {
      if (refMenu.current !== null && !refMenu.current.contains(evenement.target as Node)) {
        setMenuOuvert(false)
      }
    }

    function gererEchap(evenement: KeyboardEvent): void {
      if (evenement.key === 'Escape') {
        setMenuOuvert(false)
      }
    }

    document.addEventListener('mousedown', gererClicExterieur)
    document.addEventListener('keydown', gererEchap)
    return () => {
      document.removeEventListener('mousedown', gererClicExterieur)
      document.removeEventListener('keydown', gererEchap)
    }
  }, [menuOuvert])

  const titreBrut = texteLangue(fiche.titre, langue).trim()
  const titre = titreBrut !== '' ? titreBrut : t('questionnaires.liste.sansTitre')
  const initiales = Array.from(titre).slice(0, 2).join('').toUpperCase()

  const questions = fiche.version !== null ? [...fiche.version.questions].sort((a, b) => a.ordre - b.ordre) : []
  const nombreQuestions = questions.length
  const nombreObligatoires = questions.filter((question) => question.obligatoire).length
  const partObligatoires = nombreQuestions === 0 ? 0 : (nombreObligatoires / nombreQuestions) * 100

  // Un questionnaire actif sans point de contact ne peut recevoir aucune reponse
  const alerteSansPoint = fiche.statut === 'ACTIF' && fiche.points_contact.length === 0

  const texteVersion =
    fiche.version !== null
      ? t('questionnaires.liste.version', { numero: fiche.version.numero })
      : t('questionnaires.liste.aucuneVersion')
  const publieLe = fiche.version !== null ? fiche.version.publie_le : null
  const texteLangueDefaut =
    fiche.langue_defaut === 'fr' || fiche.langue_defaut === 'en'
      ? t(`questionnaires.page.detail.langues.${fiche.langue_defaut}`)
      : fiche.langue_defaut.toUpperCase()

  return (
    <div className="questionnaires-detail">
      <div className="questionnaires-detail-entete">
        <span className="questionnaires-detail-libelle">{t('questionnaires.page.detail.entete')}</span>

        {peutModifier && (
          <div className="questionnaires-detail-menu-conteneur" ref={refMenu}>
            <button
              type="button"
              className="questionnaires-detail-menu"
              aria-label={t('questionnaires.page.detail.options')}
              aria-haspopup="menu"
              aria-expanded={menuOuvert}
              onClick={() => setMenuOuvert((actuel) => !actuel)}
            >
              ⋯
            </button>
            {menuOuvert && (
              <div className="questionnaires-detail-menu-liste" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  className="questionnaires-detail-menu-option"
                  onClick={() => {
                    setMenuOuvert(false)
                    onModifier(fiche.id)
                  }}
                >
                  <IconeModifier className="questionnaires-detail-menu-icone-svg" />
                  {t('questionnaires.page.detail.modifier')}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="questionnaires-detail-menu-option"
                  disabled={duplicationEnCours}
                  onClick={() => {
                    setMenuOuvert(false)
                    onDupliquer(fiche.id)
                  }}
                >
                  <IconeDupliquer className="questionnaires-detail-menu-icone-svg" />
                  {duplicationEnCours ? t('questionnaires.duplication.enCours') : t('questionnaires.page.detail.dupliquer')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="questionnaires-detail-identite">
        <div className={`questionnaires-detail-badge questionnaires-detail-badge--${fiche.statut.toLowerCase()}`}>
          {initiales}
        </div>
        <div className="questionnaires-detail-identite-texte">
          <div className="questionnaires-detail-identite-ligne">
            <span className="questionnaires-detail-nom">{titre}</span>
            <span className={`questionnaires-detail-statut questionnaires-detail-statut--${fiche.statut.toLowerCase()}`}>
              {t(`questionnaires.statuts.${fiche.statut}`)}
            </span>
            {alerteSansPoint && (
              <span
                className="questionnaires-detail-statut questionnaires-detail-statut--alerte"
                title={t('questionnaires.page.alerteSansPoint')}
              >
                <IconeAttention className="questionnaires-detail-alerte-icone-svg" />
                {t('questionnaires.page.detail.sansPointContact')}
              </span>
            )}
          </div>
          <div className="questionnaires-detail-meta">
            {texteVersion} · {publieLe !== null ? formaterDate(publieLe, langue) : t('questionnaires.liste.nonPublie')}
          </div>
        </div>
      </div>

      <div className="questionnaires-detail-onglets" role="tablist">
        {ONGLETS.map((cle) => (
          <button
            key={cle}
            type="button"
            role="tab"
            aria-selected={onglet === cle}
            className={`questionnaires-detail-onglet${onglet === cle ? ' questionnaires-detail-onglet--actif' : ''}`}
            onClick={() => setOnglet(cle)}
          >
            {t(`questionnaires.page.detail.onglets.${cle}`)}
          </button>
        ))}
      </div>

      {onglet === 'apercu' && (
        <div className="questionnaires-detail-grille" role="tabpanel">
          <div className="questionnaires-detail-carte">
            <div className="questionnaires-detail-carte-titre">{t('questionnaires.page.detail.apercu.obligatoires')}</div>
            <div className="questionnaires-detail-carte-valeur">
              {nombreObligatoires} / {nombreQuestions}
            </div>
            <div className="questionnaires-detail-barre">
              <div
                className="questionnaires-detail-barre-remplissage"
                style={{ width: `${Math.min(100, partObligatoires)}%` }}
              />
            </div>
          </div>

          <div className="questionnaires-detail-carte questionnaires-detail-carte--taux">
            <div className="questionnaires-detail-carte-titre">{t('questionnaires.page.detail.apercu.tauxObligatoires')}</div>
            <div className="questionnaires-detail-carte-valeur">
              <CompteurAnime valeur={partObligatoires} duree={600} />%
            </div>
            <div className="questionnaires-detail-vague">
              <VagueDecorative />
            </div>
          </div>

          <div className="questionnaires-detail-carte questionnaires-detail-carte--mini">
            <div className="questionnaires-detail-carte-icone">
              <IconeQuestions className="questionnaires-detail-carte-icone-svg" />
            </div>
            <div>
              <div className="questionnaires-detail-carte-titre">{t('questionnaires.page.detail.apercu.questions')}</div>
              <div className="questionnaires-detail-carte-valeur">{nombreQuestions}</div>
            </div>
          </div>

          <div className="questionnaires-detail-carte questionnaires-detail-carte--mini">
            <div className="questionnaires-detail-carte-icone">
              <IconeEpingle className="questionnaires-detail-carte-icone-svg" />
            </div>
            <div>
              <div className="questionnaires-detail-carte-titre">{t('questionnaires.page.detail.apercu.pointsContact')}</div>
              <div className="questionnaires-detail-carte-valeur">{fiche.points_contact.length}</div>
            </div>
          </div>
        </div>
      )}

      {onglet === 'informations' && (
        <div className="questionnaires-detail-infos" role="tabpanel">
          <div className="questionnaires-detail-info-ligne">
            <span className="questionnaires-detail-info-cle">{t('questionnaires.page.detail.infos.statut')}</span>
            <span className="questionnaires-detail-info-valeur">{t(`questionnaires.statuts.${fiche.statut}`)}</span>
          </div>
          <div className="questionnaires-detail-info-ligne">
            <span className="questionnaires-detail-info-cle">{t('questionnaires.page.detail.infos.version')}</span>
            <span className="questionnaires-detail-info-valeur">{texteVersion}</span>
          </div>
          <div className="questionnaires-detail-info-ligne">
            <span className="questionnaires-detail-info-cle">{t('questionnaires.page.detail.infos.publication')}</span>
            <span className="questionnaires-detail-info-valeur">
              {publieLe !== null ? formaterDate(publieLe, langue) : t('questionnaires.liste.nonPublie')}
            </span>
          </div>
          <div className="questionnaires-detail-info-ligne">
            <span className="questionnaires-detail-info-cle">{t('questionnaires.page.detail.infos.langue')}</span>
            <span className="questionnaires-detail-info-valeur">{texteLangueDefaut}</span>
          </div>
          <div className="questionnaires-detail-info-ligne">
            <span className="questionnaires-detail-info-cle">{t('questionnaires.page.detail.infos.creeLe')}</span>
            <span className="questionnaires-detail-info-valeur">{formaterDate(fiche.cree_le, langue)}</span>
          </div>
          <div className="questionnaires-detail-info-ligne">
            <span className="questionnaires-detail-info-cle">{t('questionnaires.page.detail.infos.modifieLe')}</span>
            <span className="questionnaires-detail-info-valeur">{formaterDate(fiche.modifie_le, langue)}</span>
          </div>
        </div>
      )}

      {onglet === 'questions' && (
        <div className="questionnaires-detail-questions" role="tabpanel">
          {questions.length === 0 ? (
            <div className="questionnaires-detail-questions-vide">{t('questionnaires.page.detail.questionsListe.vide')}</div>
          ) : (
            questions.map((question, i) => {
              const Icone = iconesParType[question.type]
              return (
                <div key={question.id} className="questionnaires-detail-question">
                  <span className="questionnaires-detail-question-numero">{i + 1}</span>
                  <span className="questionnaires-detail-question-icone" title={t(`questionnaires.page.typesCourts.${question.type}`)}>
                    <Icone className="questionnaires-detail-question-icone-svg" />
                  </span>
                  <span className="questionnaires-detail-question-libelle">{texteLangue(question.libelle, langue)}</span>
                  {question.obligatoire && (
                    <span className="questionnaires-detail-question-obligatoire">
                      {t('questionnaires.page.detail.questionsListe.obligatoire')}
                    </span>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

type Proprietes = {
  // Questionnaire choisi dans le graphe ; null = aucun.
  selectionId: string | null
  // Fiche complete deja chargee par la page ; null tant qu'elle n'est pas chargee.
  fiche: FicheQuestionnaire | null
  // Vrai tant que la fiche n'est pas chargee.
  chargement: boolean
  // Vrai si le chargement de la fiche a echoue.
  erreur: boolean
  // Vrai pour le Responsable : le menu (modifier, dupliquer) est affiche.
  peutModifier: boolean
  duplicationEnCours: boolean
  onReessayer: () => void
  onModifier: (id: string) => void
  onDupliquer: (id: string) => void
}

export function DetailQuestionnaire({
  selectionId,
  fiche,
  chargement,
  erreur,
  peutModifier,
  duplicationEnCours,
  onReessayer,
  onModifier,
  onDupliquer,
}: Proprietes) {
  const { t } = utiliserLangue()

  // Aucun questionnaire choisi
  if (selectionId === null) {
    return (
      <div className="questionnaires-detail-vide">
        <div className="questionnaires-detail-vide-icone">
          <IconeVideSelection className="questionnaires-detail-vide-icone-svg" />
        </div>
        <span>{t('questionnaires.page.detail.vide')}</span>
      </div>
    )
  }

  if (erreur) {
    return (
      <div className="questionnaires-detail questionnaires-detail--erreur" role="alert">
        <span>{t('questionnaires.page.detail.erreur')}</span>
        <button type="button" className="questionnaires-detail-reessayer" onClick={onReessayer}>
          {t('questionnaires.page.reessayer')}
        </button>
      </div>
    )
  }

  // Fiche en cours de chargement, ou fiche d'un autre questionnaire encore affichee : squelette
  if (chargement || fiche === null || fiche.id !== selectionId) {
    return <SqueletteDetail libelle={t('questionnaires.page.detail.chargement')} />
  }

  return (
    <ContenuDetail
      key={fiche.id}
      fiche={fiche}
      peutModifier={peutModifier}
      duplicationEnCours={duplicationEnCours}
      onModifier={onModifier}
      onDupliquer={onDupliquer}
    />
  )
}