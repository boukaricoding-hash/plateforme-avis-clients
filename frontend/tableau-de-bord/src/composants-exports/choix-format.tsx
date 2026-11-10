import { useId } from 'react'
import { IconeCoche } from '../composants-avis/icones-avis'
import { utiliserLangue } from '../hooks/utiliser-langue'
import type { FiltresEcranExport, FormatExport, PeriodeExport } from '../types/exports'
import type { ResumeQuestionnaire } from '../types/questionnaires'
import type { PointContact, Site } from '../types/sites-points'
import type { ErreurPeriode } from '../utilitaires/periodes'
import { cleTexteStatut, STATUTS_AVIS } from '../utilitaires/statuts-avis'

// Choix du format et des filtres de l'ecran E16 (jour 21, fichier 18) : les trois formats
// (CSV, Excel, rapport PDF), la periode, puis site, point de contact, questionnaire, statut et
// les deux cases (avis negatifs, avec commentaire).
// Le composant n'affiche que ce que le hook utiliserExport lui donne et lui renvoie les choix :
// il ne charge rien et ne calcule rien. Ce qui est tape dans la barre de recherche et ce qui est
// choisi ici sont la meme chose : le hook garde les deux a jour.
// Style : classes Tailwind seulement, aucune classe a ajouter dans exports.css.
// Textes : cles exports.choix.* (fichiers 23 et 24), plus des cles qui existent deja
// (tableau.filtres.*, avis.filtres.negatifs, avis.statuts.*) et exports.formats.* (csv, xlsx, pdf).

const FORMATS: readonly FormatExport[] = ['csv', 'xlsx', 'pdf']

// Ce qui est ecrit dans la pastille de chaque format (le nom du fichier, pas une phrase a traduire).
const EXTENSIONS: Record<FormatExport, string> = {
  csv: 'CSV',
  xlsx: 'XLSX',
  pdf: 'PDF',
}

const PERIODES: readonly PeriodeExport[] = [
  'aujourdhui',
  '7jours',
  '30jours',
  'mois',
  'personnalisee',
  'tout',
]

const CLASSES_ETIQUETTE = 'mb-2 block text-sm font-medium text-texte-secondaire'
const CLASSES_TITRE = 'm-0 mb-3 text-base font-semibold text-texte'

type PropsChoixFormat = {
  format: FormatExport | null
  onChoisirFormat: (format: FormatExport) => void
  filtres: FiltresEcranExport
  onChangerFiltres: (changements: Partial<FiltresEcranExport>) => void
  // Erreur de la periode personnalisee (dates manquantes, inversees ou trop longues), sinon null.
  erreurPeriode: ErreurPeriode | null
  // Vrai : le rapport pdf va prendre les 30 derniers jours, car aucune date n'est choisie.
  rapportSurTrenteJours: boolean
  sites: Site[]
  points: PointContact[]
  questionnaires: ResumeQuestionnaire[]
  erreurListes: boolean
}

type Option = { valeur: string; libelle: string }

// ------------------------------------------------------------
// Petits composants
// ------------------------------------------------------------

type PropsSelecteur = {
  etiquette: string
  valeur: string
  toutes: string
  options: Option[]
  onChanger: (valeur: string) => void
}

// Une liste deroulante avec son etiquette et un premier choix "tous".
function Selecteur({ etiquette, valeur, toutes, options, onChanger }: PropsSelecteur) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className={CLASSES_ETIQUETTE}>
        {etiquette}
      </label>
      <select
        id={id}
        value={valeur}
        onChange={(evenement) => onChanger(evenement.target.value)}
        className="min-h-11 w-full rounded-md border border-bordure-champ bg-surface px-3 text-base text-texte"
      >
        <option value="">{toutes}</option>
        {options.map((option) => (
          <option key={option.valeur} value={option.valeur}>
            {option.libelle}
          </option>
        ))}
      </select>
    </div>
  )
}

type PropsChampDate = {
  etiquette: string
  valeur: string
  invalide: boolean
  onChanger: (valeur: string) => void
}

function ChampDate({ etiquette, valeur, invalide, onChanger }: PropsChampDate) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className={CLASSES_ETIQUETTE}>
        {etiquette}
      </label>
      <input
        id={id}
        type="date"
        value={valeur}
        aria-invalid={invalide}
        onChange={(evenement) => onChanger(evenement.target.value)}
        className={`min-h-11 w-full rounded-md border bg-surface px-3 text-base text-texte ${
          invalide ? 'border-erreur' : 'border-bordure-champ'
        }`}
      />
    </div>
  )
}

type PropsCaseACocher = {
  etiquette: string
  cochee: boolean
  onChanger: (cochee: boolean) => void
}

function CaseACocher({ etiquette, cochee, onChanger }: PropsCaseACocher) {
  const id = useId()
  return (
    <div className="flex min-h-11 items-center gap-3">
      <input
        id={id}
        type="checkbox"
        checked={cochee}
        onChange={(evenement) => onChanger(evenement.target.checked)}
        className="h-5 w-5 shrink-0"
        style={{ accentColor: 'var(--couleur-principale)' }}
      />
      <label htmlFor={id} className="text-base text-texte">
        {etiquette}
      </label>
    </div>
  )
}

// ------------------------------------------------------------
// Le composant
// ------------------------------------------------------------

export function ChoixFormat({
  format,
  onChoisirFormat,
  filtres,
  onChangerFiltres,
  erreurPeriode,
  rapportSurTrenteJours,
  sites,
  points,
  questionnaires,
  erreurListes,
}: PropsChoixFormat) {
  const { t, langue } = utiliserLangue()
  const idPeriode = useId()
  const idErreurPeriode = useId()

  const nomsSites = new Map(sites.map((site) => [site.id, site.nom]))

  const optionsSites: Option[] = sites.map((site) => ({ valeur: site.id, libelle: site.nom }))

  // Un site choisi ne montre que ses points de contact. Sans site, on ajoute le nom du site
  // pour distinguer deux "Table 1".
  const optionsPoints: Option[] = points
    .filter((point) => filtres.site === '' || point.site_id === filtres.site)
    .map((point) => {
      const nomSite = nomsSites.get(point.site_id)
      const libelle =
        filtres.site === '' && nomSite !== undefined ? `${point.nom} (${nomSite})` : point.nom
      return { valeur: point.id, libelle }
    })

  const optionsQuestionnaires: Option[] = questionnaires.map((questionnaire) => ({
    valeur: questionnaire.id,
    libelle: langue === 'en' ? (questionnaire.titre.en ?? questionnaire.titre.fr) : questionnaire.titre.fr,
  }))

  const optionsStatuts: Option[] = STATUTS_AVIS.map((statut) => ({
    valeur: statut,
    libelle: t(cleTexteStatut(statut)),
  }))

  return (
    <div className="flex flex-col gap-8">
      {/* 1. Format */}
      <fieldset className="m-0 min-w-0 border-0 p-0">
        <legend className={CLASSES_TITRE}>{t('exports.choix.format')}</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {FORMATS.map((formatPropose) => (
            <label
              key={formatPropose}
              className="relative flex cursor-pointer flex-col gap-3 rounded-xl border border-bordure-champ bg-surface p-4 transition-colors hover:bg-surface-douce has-[:checked]:border-principale has-[:checked]:bg-surface-douce has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-principale"
            >
              <input
                type="radio"
                name="format-export"
                value={formatPropose}
                checked={format === formatPropose}
                onChange={() => onChoisirFormat(formatPropose)}
                className="peer sr-only"
              />
              <span
                aria-hidden="true"
                className="absolute top-3 right-3 inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-bordure-champ text-texte-sur-principale transition-colors peer-checked:border-principale peer-checked:bg-principale [&>svg]:opacity-0 peer-checked:[&>svg]:opacity-100"
              >
                <IconeCoche width={14} height={14} />
              </span>
              <span
                aria-hidden="true"
                className="inline-flex h-10 w-14 items-center justify-center rounded-lg border border-bordure-forte bg-fond-alt text-xs font-bold tracking-wide text-texte"
              >
                {EXTENSIONS[formatPropose]}
              </span>
              <span className="text-base font-semibold text-texte">
                {t(`exports.formats.${formatPropose}`)}
              </span>
              <span className="text-sm leading-snug text-texte-secondaire">
                {t(`exports.choix.descriptions.${formatPropose}`)}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* 2. Periode */}
      <div>
        <p id={idPeriode} className={CLASSES_TITRE}>
          {t('exports.choix.periode')}
        </p>
        <div role="group" aria-labelledby={idPeriode} className="flex flex-wrap gap-2">
          {PERIODES.map((periode) => {
            const actif = filtres.periode === periode
            return (
              <button
                key={periode}
                type="button"
                aria-pressed={actif}
                onClick={() => onChangerFiltres({ periode })}
                className={`min-h-11 cursor-pointer rounded-full border-0 px-4 text-sm font-medium transition-colors ${
                  actif
                    ? 'bg-principale text-texte-sur-principale'
                    : 'bg-fond-alt text-texte hover:bg-surface-douce'
                }`}
              >
                {periode === 'tout'
                  ? t('exports.choix.toutesLesDates')
                  : t(`tableau.filtres.periodes.${periode}`)}
              </button>
            )
          })}
        </div>

        {filtres.periode === 'personnalisee' && (
          <div className="mt-4" aria-describedby={erreurPeriode !== null ? idErreurPeriode : undefined}>
            <div className="grid gap-4 sm:grid-cols-2 lg:max-w-xl">
              <ChampDate
                etiquette={t('tableau.filtres.du')}
                valeur={filtres.debut}
                invalide={erreurPeriode !== null}
                onChanger={(debut) => onChangerFiltres({ debut })}
              />
              <ChampDate
                etiquette={t('tableau.filtres.au')}
                valeur={filtres.fin}
                invalide={erreurPeriode !== null}
                onChanger={(fin) => onChangerFiltres({ fin })}
              />
            </div>
            {erreurPeriode !== null && (
              <p id={idErreurPeriode} role="alert" className="mt-2 text-sm text-erreur">
                {t(`tableau.filtres.${erreurPeriode}`)}
              </p>
            )}
          </div>
        )}

        {rapportSurTrenteJours && (
          <p className="mt-3 text-sm text-texte-secondaire">
            {t('exports.choix.rapportTrenteJours')}
          </p>
        )}
      </div>

      {/* 3. Filtres */}
      <div>
        <h2 className={CLASSES_TITRE}>{t('exports.choix.filtres')}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Selecteur
            etiquette={t('tableau.filtres.site')}
            valeur={filtres.site}
            toutes={t('tableau.filtres.tousLesSites')}
            options={optionsSites}
            onChanger={(site) => onChangerFiltres({ site })}
          />
          <Selecteur
            etiquette={t('tableau.filtres.point')}
            valeur={filtres.point}
            toutes={t('tableau.filtres.tousLesPoints')}
            options={optionsPoints}
            onChanger={(point) => onChangerFiltres({ point })}
          />
          <Selecteur
            etiquette={t('tableau.filtres.questionnaire')}
            valeur={filtres.questionnaire}
            toutes={t('tableau.filtres.tousLesQuestionnaires')}
            options={optionsQuestionnaires}
            onChanger={(questionnaire) => onChangerFiltres({ questionnaire })}
          />
          <Selecteur
            etiquette={t('avis.filtres.statut')}
            valeur={filtres.statut}
            toutes={t('avis.filtres.tousLesStatuts')}
            options={optionsStatuts}
            onChanger={(valeur) =>
              onChangerFiltres({ statut: STATUTS_AVIS.find((statut) => statut === valeur) ?? '' })
            }
          />
        </div>

        <div className="mt-4 flex flex-col gap-1 sm:flex-row sm:gap-8">
          <CaseACocher
            etiquette={t('avis.filtres.negatifs')}
            cochee={filtres.negatifs}
            onChanger={(negatifs) => onChangerFiltres({ negatifs })}
          />
          <CaseACocher
            etiquette={t('avis.filtres.avecCommentaire')}
            cochee={filtres.avecCommentaire}
            onChanger={(avecCommentaire) => onChangerFiltres({ avecCommentaire })}
          />
        </div>

        {erreurListes && (
          <p role="status" className="mt-3 text-sm text-erreur">
            {t('tableau.filtres.erreurListes')}
          </p>
        )}
      </div>
    </div>
  )
}