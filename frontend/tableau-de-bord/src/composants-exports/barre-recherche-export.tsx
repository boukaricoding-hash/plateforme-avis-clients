import { useId, useRef } from 'react'
import type { KeyboardEvent } from 'react'
import {
  IconeCalendrier,
  IconeCommentaire,
  IconeDocument,
  IconeEpingle,
  IconeFiltresStatut,
  IconeRecherche,
  IconeReponses,
  IconeScore,
  IconeTable,
} from '../composants-avis/icones-avis'
import { IconeFermer } from '../composants-questionnaires/icones-questionnaires'
import type { ComposantIcone } from '../composants-tableau/icones-accueil'
import { utiliserLangue } from '../hooks/utiliser-langue'
import type { HumeurRobot } from '../types/exports'
import type { MotCompris, ProblemeRecherche } from '../utilitaires/comprendre-recherche'
import { formaterJour, type ErreurPeriode } from '../utilitaires/periodes'
import { cleTexteStatut } from '../utilitaires/statuts-avis'

// Barre de recherche de l'ecran E16 (jour 21, fichier 16) : l'utilisateur ecrit ce qu'il veut
// exporter ("excel 7 jours negatifs table 12"), le robot comprend les mots et les affiche en
// pastilles. Ce composant n'affiche que ce que le hook utiliserExport lui donne : il ne fait
// aucun appel a l'API et ne calcule rien. La comprehension du texte est dans
// utilitaires/comprendre-recherche.ts, l'etat dans hooks/utiliser-export.ts.
//
// Mise en page : le composant prend toute la largeur que la page lui donne (w-full). C'est la page
// (fichier 20) qui le centre, avec des marges a gauche et a droite, et qui place les indications
// 1, 2, 3, 4 (fichier 17) a droite de la barre.
// Style : classes Tailwind, plus deux classes a definir dans styles/exports.css (fichier 21) :
// - exports-barre : halo autour de la barre quand elle a le focus ;
// - exports-pastille : petite animation d'apparition d'une pastille (coupee si l'utilisateur
//   demande moins d'animations).
// Textes : cles exports.barre.* (fichiers 23 et 24), plus des cles qui existent deja
// (tableau.filtres.*, tableau.periodeAffichee, avis.statuts.*) et exports.formats.* (csv, xlsx, pdf).

const LONGUEUR_MAX_TEXTE = 200

// Cles des phrases d'exemple proposees quand la barre est vide.
const CLES_SUGGESTIONS: readonly string[] = [
  'exports.barre.suggestions.excelTrenteJours',
  'exports.barre.suggestions.pdfSeptJours',
  'exports.barre.suggestions.csvNegatifs',
  'exports.barre.suggestions.excelCommentaires',
]

type PropsBarreRechercheExport = {
  texte: string
  onChangerTexte: (texte: string) => void
  // Mots compris par le robot (pastilles) et ce qu'il n'a pas pu faire.
  mots: MotCompris[]
  problemes: ProblemeRecherche[]
  // Erreur de la periode (dates manquantes, inversees ou trop longues), choisie a la main ou tapee.
  erreurPeriode: ErreurPeriode | null
  // Seule l'humeur "inquiet" change l'aspect de la barre (bordure rouge).
  humeur: HumeurRobot
}

type Pastille = {
  cle: string
  Icone: ComposantIcone
  libelle: string
  // Les avis negatifs sont en rouge : la couleur ne suffit pas, le texte dit aussi "negatifs".
  alerte: boolean
}

type FonctionTexte = (cle: string, valeurs?: Record<string, string | number>) => string

// Transforme un mot compris en pastille : une icone et un texte.
function versPastille(mot: MotCompris, t: FonctionTexte, formaterDate: (jour: string) => string): Pastille {
  switch (mot.type) {
    case 'format':
      return {
        cle: `format-${mot.valeur}`,
        Icone: IconeDocument,
        libelle: t(`exports.formats.${mot.valeur}`),
        alerte: false,
      }
    case 'periode': {
      let libelle: string
      if (mot.valeur === 'tout') {
        libelle = t('exports.barre.pastilles.tout')
      } else if (mot.valeur === 'personnalisee' && mot.debut !== '' && mot.fin !== '') {
        libelle = t('tableau.periodeAffichee', {
          debut: formaterDate(mot.debut),
          fin: formaterDate(mot.fin),
        })
      } else {
        libelle = t(`tableau.filtres.periodes.${mot.valeur}`)
      }
      return { cle: `periode-${mot.valeur}-${mot.debut}-${mot.fin}`, Icone: IconeCalendrier, libelle, alerte: false }
    }
    case 'statut':
      return {
        cle: `statut-${mot.valeur}`,
        Icone: IconeFiltresStatut,
        libelle: t(cleTexteStatut(mot.valeur)),
        alerte: false,
      }
    case 'negatifs':
      return { cle: 'negatifs', Icone: IconeScore, libelle: t('exports.barre.pastilles.negatifs'), alerte: true }
    case 'commentaire':
      return {
        cle: 'commentaire',
        Icone: IconeCommentaire,
        libelle: t('exports.barre.pastilles.commentaire'),
        alerte: false,
      }
    case 'site':
      return { cle: `site-${mot.id}`, Icone: IconeEpingle, libelle: mot.nom, alerte: false }
    case 'point':
      return { cle: `point-${mot.id}`, Icone: IconeTable, libelle: mot.nom, alerte: false }
    case 'questionnaire':
      return { cle: `questionnaire-${mot.id}`, Icone: IconeReponses, libelle: mot.nom, alerte: false }
  }
}

// Les messages du robot quand il n'a pas pu faire ce qu'on lui demande. Un meme message n'apparait
// qu'une fois : la periode tapee en trop longue est vue par le texte ET par le choix des filtres.
function listerMessages(
  problemes: ProblemeRecherche[],
  erreurPeriode: ErreurPeriode | null,
  t: FonctionTexte,
): string[] {
  const messages = new Set<string>()
  for (const probleme of problemes) {
    if (probleme.type === 'periode') {
      messages.add(t(`tableau.filtres.${probleme.erreur}`))
    } else {
      messages.add(t('exports.barre.ambigu', { nom: probleme.nom }))
    }
  }
  if (erreurPeriode !== null) {
    messages.add(t(`tableau.filtres.${erreurPeriode}`))
  }
  return [...messages]
}

export function BarreRechercheExport({
  texte,
  onChangerTexte,
  mots,
  problemes,
  erreurPeriode,
  humeur,
}: PropsBarreRechercheExport) {
  const { t, langue } = utiliserLangue()
  const idChamp = useId()
  const idAide = useId()
  const refChamp = useRef<HTMLInputElement>(null)

  const pastilles = mots.map((mot) => versPastille(mot, t, (jour) => formaterJour(jour, langue)))
  const messages = listerMessages(problemes, erreurPeriode, t)
  const texteVide = texte.trim() === ''

  function effacer(): void {
    onChangerTexte('')
    refChamp.current?.focus()
  }

  // Echap vide la barre (comme la croix), sans rien faire si elle est deja vide.
  function surTouche(evenement: KeyboardEvent<HTMLInputElement>): void {
    if (evenement.key === 'Escape' && texte !== '') {
      evenement.preventDefault()
      effacer()
    }
  }

  const classeBordure =
    humeur === 'inquiet' ? 'border-erreur' : 'border-bordure-champ focus-within:border-principale'

  return (
    <div role="search" className="w-full min-w-0">
      <label htmlFor={idChamp} className="sr-only">
        {t('exports.barre.etiquette')}
      </label>

      <div
        className={`exports-barre flex min-h-14 w-full items-center gap-3 rounded-2xl border bg-surface px-4 shadow-doux transition-colors ${classeBordure}`}
      >
        <IconeRecherche width={22} height={22} className="shrink-0 text-texte-secondaire" />
        <input
          ref={refChamp}
          id={idChamp}
          type="text"
          value={texte}
          maxLength={LONGUEUR_MAX_TEXTE}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          placeholder={t('exports.barre.placeholder')}
          aria-describedby={idAide}
          aria-invalid={messages.length > 0}
          onChange={(evenement) => onChangerTexte(evenement.target.value)}
          onKeyDown={surTouche}
          className="h-14 min-w-0 flex-1 border-0 bg-transparent text-base text-texte outline-none placeholder:text-texte-discret"
        />
        {texte !== '' && (
          <button
            type="button"
            onClick={effacer}
            aria-label={t('exports.barre.effacer')}
            className="-mr-2 inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-texte-secondaire hover:text-texte"
          >
            <IconeFermer width={18} height={18} />
          </button>
        )}
      </div>

      <div id={idAide} className="mt-3 flex flex-col gap-3">
        {pastilles.length > 0 && (
          <ul
            aria-label={t('exports.barre.motsComprisTitre')}
            className="m-0 flex list-none flex-wrap gap-2 p-0"
          >
            {pastilles.map(({ cle, Icone, libelle, alerte }) => (
              <li
                key={cle}
                className={`exports-pastille inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-full border bg-surface-douce px-3 text-sm ${
                  alerte ? 'border-erreur text-erreur' : 'border-bordure-champ text-texte'
                }`}
              >
                <Icone width={15} height={15} className="shrink-0" />
                <span className="truncate">{libelle}</span>
              </li>
            ))}
          </ul>
        )}

        {messages.length > 0 && (
          <ul role="status" className="m-0 flex list-none flex-col gap-1 p-0 text-sm text-erreur">
            {messages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        )}

        {texteVide ? (
          <div className="flex flex-col gap-2">
            <p className="m-0 text-sm text-texte-secondaire">{t('exports.barre.aide')}</p>
            <ul
              aria-label={t('exports.barre.suggestionsTitre')}
              className="m-0 flex list-none flex-wrap gap-2 p-0"
            >
              {CLES_SUGGESTIONS.map((cle) => {
                const suggestion = t(cle)
                return (
                  <li key={cle}>
                    <button
                      type="button"
                      onClick={() => {
                        onChangerTexte(suggestion)
                        refChamp.current?.focus()
                      }}
                      className="inline-flex min-h-10 cursor-pointer items-center rounded-full border border-bordure bg-transparent px-3 text-sm text-texte-secondaire transition-colors hover:border-bordure-champ hover:text-texte"
                    >
                      {suggestion}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ) : (
          pastilles.length === 0 &&
          messages.length === 0 && (
            <p className="m-0 text-sm text-texte-secondaire">{t('exports.barre.aucunMot')}</p>
          )
        )}
      </div>
    </div>
  )
}