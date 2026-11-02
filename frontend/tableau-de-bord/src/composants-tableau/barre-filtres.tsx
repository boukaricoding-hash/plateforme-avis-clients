import { useId } from 'react'
import { utiliserLangue } from '../hooks/utiliser-langue'
import type {
  ChoixPeriode,
  FiltresTableau,
  PointContactFiltre,
  QuestionnaireFiltre,
  SiteFiltre,
} from '../types/tableau-de-bord'
import type { ErreurPeriode } from '../utilitaires/periodes'

// Filtres de l'ecran E7 : periode, site, point de contact, questionnaire.
// Presentation en sections aerees, sans cadre : le fond est translucide et se fond dans la page.
// Elle ne charge rien : elle recoit l'etat et les listes du hook utiliserDonneesTableau.

const PERIODES: ChoixPeriode[] = ['aujourdhui', '7jours', '30jours', 'mois', 'personnalisee']

const CLASSES_ETIQUETTE = 'mb-2 block text-sm font-medium text-texte-secondaire'

type Option = { valeur: string; libelle: string }

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

type Proprietes = {
  filtres: FiltresTableau
  onChanger: (modifications: Partial<FiltresTableau>) => void
  onReinitialiser: () => void
  erreurPeriode: ErreurPeriode | null
  sites: SiteFiltre[]
  pointsContact: PointContactFiltre[]
  questionnaires: QuestionnaireFiltre[]
  erreurListes: boolean
}

export function BarreFiltres({
  filtres,
  onChanger,
  onReinitialiser,
  erreurPeriode,
  sites,
  pointsContact,
  questionnaires,
  erreurListes,
}: Proprietes) {
  const { t, langue } = utiliserLangue()
  const idTitre = useId()
  const idPeriode = useId()
  const idErreurPeriode = useId()

  const nomsSites = new Map(sites.map((site) => [site.id, site.nom]))

  const optionsSites: Option[] = sites.map((site) => ({ valeur: site.id, libelle: site.nom }))

  // Sans site choisi, on ajoute le nom du site pour distinguer deux "Table 1".
  const optionsPoints: Option[] = pointsContact.map((point) => {
    const nomSite = nomsSites.get(point.site_id)
    const libelle =
      filtres.site === '' && nomSite !== undefined ? `${point.nom} (${nomSite})` : point.nom
    return { valeur: point.id, libelle }
  })

  const optionsQuestionnaires: Option[] = questionnaires.map((questionnaire) => ({
    valeur: questionnaire.id,
    libelle: langue === 'en' ? (questionnaire.titre.en ?? questionnaire.titre.fr) : questionnaire.titre.fr,
  }))

  const parDefaut =
    filtres.periode === '30jours' &&
    filtres.site === '' &&
    filtres.point === '' &&
    filtres.questionnaire === ''

  return (
    <section aria-labelledby={idTitre} className="rounded-lg bg-surface/50 p-5 sm:p-6">
      <h2 id={idTitre} className="sr-only">
        {t('tableau.filtres.titre')}
      </h2>

      {/* Periode */}
      <div>
        <p id={idPeriode} className={CLASSES_ETIQUETTE}>
          {t('tableau.filtres.periode')}
        </p>
        <div role="group" aria-labelledby={idPeriode} className="flex flex-wrap gap-2">
          {PERIODES.map((periode) => {
            const actif = filtres.periode === periode
            return (
              <button
                key={periode}
                type="button"
                aria-pressed={actif}
                onClick={() => onChanger({ periode })}
                className={`min-h-11 rounded-full px-4 text-sm font-medium transition-colors ${
                  actif
                    ? 'bg-principale text-texte-sur-principale'
                    : 'bg-fond-alt text-texte hover:bg-surface-douce'
                }`}
              >
                {t(`tableau.filtres.periodes.${periode}`)}
              </button>
            )
          })}
        </div>
      </div>

      {/* Dates de la periode personnalisee */}
      {filtres.periode === 'personnalisee' && (
        <div className="mt-4" aria-describedby={erreurPeriode !== null ? idErreurPeriode : undefined}>
          <div className="grid gap-4 sm:grid-cols-2 lg:max-w-xl">
            <ChampDate
              etiquette={t('tableau.filtres.du')}
              valeur={filtres.debut}
              invalide={erreurPeriode !== null}
              onChanger={(debut) => onChanger({ debut })}
            />
            <ChampDate
              etiquette={t('tableau.filtres.au')}
              valeur={filtres.fin}
              invalide={erreurPeriode !== null}
              onChanger={(fin) => onChanger({ fin })}
            />
          </div>
          {erreurPeriode !== null && (
            <p id={idErreurPeriode} role="alert" className="mt-2 text-sm text-erreur">
              {t(`tableau.filtres.${erreurPeriode}`)}
            </p>
          )}
        </div>
      )}

      {/* Site, point de contact, questionnaire */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Selecteur
          etiquette={t('tableau.filtres.site')}
          valeur={filtres.site}
          toutes={t('tableau.filtres.tousLesSites')}
          options={optionsSites}
          onChanger={(site) => onChanger({ site })}
        />
        <Selecteur
          etiquette={t('tableau.filtres.point')}
          valeur={filtres.point}
          toutes={t('tableau.filtres.tousLesPoints')}
          options={optionsPoints}
          onChanger={(point) => onChanger({ point })}
        />
        <Selecteur
          etiquette={t('tableau.filtres.questionnaire')}
          valeur={filtres.questionnaire}
          toutes={t('tableau.filtres.tousLesQuestionnaires')}
          options={optionsQuestionnaires}
          onChanger={(questionnaire) => onChanger({ questionnaire })}
        />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onReinitialiser}
          disabled={parDefaut}
          className="min-h-11 rounded-md px-3 text-sm font-medium text-principale-fonce underline underline-offset-4 transition-colors hover:bg-fond-alt disabled:cursor-not-allowed disabled:no-underline disabled:opacity-50"
        >
          {t('tableau.filtres.reinitialiser')}
        </button>
        {erreurListes && (
          <p role="alert" className="text-sm text-erreur">
            {t('tableau.filtres.erreurListes')}
          </p>
        )}
      </div>
    </section>
  )
}