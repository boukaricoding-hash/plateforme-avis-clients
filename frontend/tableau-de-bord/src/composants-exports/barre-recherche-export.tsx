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
import type { FiltresEcranExport, FormatExport, HumeurRobot, PeriodeExport } from '../types/exports'
import type { MotCompris, ProblemeRecherche } from '../utilitaires/comprendre-recherche'
import { formaterJour, type ErreurPeriode } from '../utilitaires/periodes'
import { cleTexteStatut } from '../utilitaires/statuts-avis'
import '../styles/exports.css'

// Barre de recherche de l'ecran E16 (jour 21, fichier 3 sur 9 du design) : l'utilisateur ecrit
// ce qu'il veut exporter ("excel 7 jours negatifs table 12"), le robot comprend les mots et les
// affiche en pastilles. Sous la barre, les choix rapides s'ouvrent quand on clique sur l'indication
// 1 (format) ou 2 (periode et filtres) : ce sont les memes reglages que ceux tapes dans la barre,
// le hook utiliserExport garde les deux a jour.
// Le composant n'affiche que ce que le hook lui donne : aucun appel a l'API, aucun calcul.
// La comprehension du texte est dans utilitaires/comprendre-recherche.ts.
// Un site, une table, un questionnaire ou un statut se disent dans la barre (par leur nom).
// Plus de grande carte, de bordure, de texte d'aide ni d'exemples : le texte du champ suffit.
// Mise en page : le composant est le bloc central de la page (classe exports-saisie-centre),
// qui le place au milieu avec les indications a sa droite (fichier 5).
// Style : aucune bordure, classes de styles/exports.css (exports-barre, exports-barre--inquiet,
// exports-champ, exports-effacer, exports-choix, exports-choix-bouton, exports-pastilles,
// exports-pastille, exports-pastille--alerte, exports-messages).
// Textes : cles exports.barre.* (fichiers 6 et 7), dont les nouveaux choixFormatTitre et
// choixPeriodeTitre, plus des cles qui existent deja (tableau.filtres.*, tableau.periodeAffichee,
// avis.statuts.*, exports.formats.*).

const LONGUEUR_MAX_TEXTE = 200

const FORMATS: readonly FormatExport[] = ['csv', 'xlsx', 'pdf']

const PERIODES: readonly PeriodeExport[] = ['aujourdhui', '7jours', '30jours', 'mois', 'tout']

type PropsBarreRechercheExport = {
  texte: string
  onChangerTexte: (texte: string) => void
  // Mots compris par le robot (pastilles) et ce qu'il n'a pas pu faire.
  mots: MotCompris[]
  problemes: ProblemeRecherche[]
  // Erreur de la periode (dates manquantes, inversees ou trop longues), choisie a la main ou tapee.
  erreurPeriode: ErreurPeriode | null
  // Seule l'humeur "inquiet" change l'aspect de la barre (halo rouge).
  humeur: HumeurRobot
  // Choix rapides ouverts sous la barre : 1 = format, 2 = periode et filtres, null = fermes.
  ouverte: 1 | 2 | null
  format: FormatExport | null
  onChoisirFormat: (format: FormatExport) => void
  filtres: FiltresEcranExport
  onChangerFiltres: (changements: Partial<FiltresEcranExport>) => void
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
// qu'une fois : la periode tapee en trop longue est vue par le texte ET par les filtres.
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
  ouverte,
  format,
  onChoisirFormat,
  filtres,
  onChangerFiltres,
}: PropsBarreRechercheExport) {
  const { t, langue } = utiliserLangue()
  const idChamp = useId()
  const idMessages = useId()
  const refChamp = useRef<HTMLInputElement>(null)

  const pastilles = mots.map((mot) => versPastille(mot, t, (jour) => formaterJour(jour, langue)))
  const messages = listerMessages(problemes, erreurPeriode, t)

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

  return (
    <div role="search" className="exports-saisie-centre">
      <label htmlFor={idChamp} className="sr-only">
        {t('exports.barre.etiquette')}
      </label>

      <div className={humeur === 'inquiet' ? 'exports-barre exports-barre--inquiet' : 'exports-barre'}>
        <IconeRecherche width={22} height={22} className="shrink-0" />
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
          aria-describedby={messages.length > 0 ? idMessages : undefined}
          aria-invalid={messages.length > 0}
          onChange={(evenement) => onChangerTexte(evenement.target.value)}
          onKeyDown={surTouche}
          className="exports-champ"
        />
        {texte !== '' && (
          <button
            type="button"
            onClick={effacer}
            aria-label={t('exports.barre.effacer')}
            className="exports-effacer"
          >
            <IconeFermer width={18} height={18} />
          </button>
        )}
      </div>

      {/* Indication 1 : le format */}
      {ouverte === 1 && (
        <ul aria-label={t('exports.barre.choixFormatTitre')} className="exports-choix">
          {FORMATS.map((valeur) => (
            <li key={valeur}>
              <button
                type="button"
                aria-pressed={format === valeur}
                onClick={() => onChoisirFormat(valeur)}
                className="exports-choix-bouton"
              >
                {t(`exports.formats.${valeur}`)}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Indication 2 : la periode et les deux cases */}
      {ouverte === 2 && (
        <ul aria-label={t('exports.barre.choixPeriodeTitre')} className="exports-choix">
          {PERIODES.map((valeur) => (
            <li key={valeur}>
              <button
                type="button"
                aria-pressed={filtres.periode === valeur}
                onClick={() => onChangerFiltres({ periode: valeur })}
                className="exports-choix-bouton"
              >
                {valeur === 'tout' ? t('exports.barre.pastilles.tout') : t(`tableau.filtres.periodes.${valeur}`)}
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              aria-pressed={filtres.negatifs}
              onClick={() => onChangerFiltres({ negatifs: !filtres.negatifs })}
              className="exports-choix-bouton"
            >
              {t('exports.barre.pastilles.negatifs')}
            </button>
          </li>
          <li>
            <button
              type="button"
              aria-pressed={filtres.avecCommentaire}
              onClick={() => onChangerFiltres({ avecCommentaire: !filtres.avecCommentaire })}
              className="exports-choix-bouton"
            >
              {t('exports.barre.pastilles.commentaire')}
            </button>
          </li>
        </ul>
      )}

      {pastilles.length > 0 && (
        <ul aria-label={t('exports.barre.motsComprisTitre')} className="exports-pastilles">
          {pastilles.map(({ cle, Icone, libelle, alerte }) => (
            <li key={cle} className={alerte ? 'exports-pastille exports-pastille--alerte' : 'exports-pastille'}>
              <Icone width={15} height={15} className="shrink-0" />
              <span className="truncate">{libelle}</span>
            </li>
          ))}
        </ul>
      )}

      {messages.length > 0 && (
        <ul id={idMessages} role="status" className="exports-messages">
          {messages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
    </div>
  )
}