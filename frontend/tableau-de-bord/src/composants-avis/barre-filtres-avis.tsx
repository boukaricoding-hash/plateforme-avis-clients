import { useEffect, useId, useState } from 'react'
import type { FormEvent } from 'react'
import { utiliserLangue } from '../hooks/utiliser-langue'
import type { ModificationsFiltresAvis } from '../hooks/utiliser-filtres-avis'
import type { ParametresListeAvis } from '../services/avis'
import { lirePointsContact, lireQuestionnaires, lireSites } from '../services/tableau-de-bord'
import type {
  PointContactFiltre,
  QuestionnaireFiltre,
  SiteFiltre,
} from '../types/tableau-de-bord'
import { formaterNombre } from '../utilitaires/periodes'
import { cleTexteStatut, STATUTS_AVIS } from '../utilitaires/statuts-avis'

// Filtres de l'ecran E8 (liste des avis) : recherche dans les commentaires, periode, statut,
// site, point de contact, questionnaire, avis negatifs, avis avec commentaire.
// Les filtres eux-memes vivent dans l'adresse de la page (hook utiliserFiltresAvis) :
// cette barre les affiche et demande les changements. Elle charge seulement les listes
// de sites, de points de contact et de questionnaires.

const CLASSES_ETIQUETTE = 'mb-2 block text-sm font-medium text-texte-secondaire'
const CLASSES_CHAMP =
  'min-h-11 w-full rounded-md border border-bordure-champ bg-surface px-3 text-base text-texte'
const LONGUEUR_MAX_RECHERCHE = 100

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
        className={CLASSES_CHAMP}
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
  onChanger: (valeur: string) => void
}

function ChampDate({ etiquette, valeur, onChanger }: PropsChampDate) {
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
        onChange={(evenement) => onChanger(evenement.target.value)}
        className={CLASSES_CHAMP}
      />
    </div>
  )
}

type PropsCase = {
  etiquette: string
  cochee: boolean
  onChanger: (cochee: boolean) => void
}

function CaseACocher({ etiquette, cochee, onChanger }: PropsCase) {
  const id = useId()
  return (
    <div className="flex min-h-11 items-center gap-2">
      <input
        id={id}
        type="checkbox"
        checked={cochee}
        onChange={(evenement) => onChanger(evenement.target.checked)}
        className="h-5 w-5 accent-principale"
      />
      <label htmlFor={id} className="text-sm text-texte">
        {etiquette}
      </label>
    </div>
  )
}

type Proprietes = {
  filtres: ParametresListeAvis
  nombreFiltresActifs: number
  onChanger: (modifications: ModificationsFiltresAvis) => void
  onReinitialiser: () => void
}

export function BarreFiltresAvis({
  filtres,
  nombreFiltresActifs,
  onChanger,
  onReinitialiser,
}: Proprietes) {
  const { t, langue } = utiliserLangue()
  const idTitre = useId()
  const idRecherche = useId()

  // --- Listes des choix --------------------------------------------------------

  const [sites, setSites] = useState<SiteFiltre[]>([])
  const [questionnaires, setQuestionnaires] = useState<QuestionnaireFiltre[]>([])
  const [pointsContact, setPointsContact] = useState<PointContactFiltre[]>([])
  const [erreurListes, setErreurListes] = useState(false)

  // Sites et questionnaires : une seule fois.
  useEffect(() => {
    let annule = false
    Promise.all([lireSites(), lireQuestionnaires()])
      .then(([reponseSites, reponseQuestionnaires]) => {
        if (annule) {
          return
        }
        setSites(reponseSites.sites)
        setQuestionnaires(reponseQuestionnaires.questionnaires)
      })
      .catch(() => {
        if (!annule) {
          setErreurListes(true)
        }
      })
    return () => {
      annule = true
    }
  }, [])

  // Points de contact : de tout l'etablissement, ou du site choisi.
  useEffect(() => {
    let annule = false
    lirePointsContact(filtres.site)
      .then((reponse) => {
        if (!annule) {
          setPointsContact(reponse.points_contact)
        }
      })
      .catch(() => {
        if (!annule) {
          setErreurListes(true)
        }
      })
    return () => {
      annule = true
    }
  }, [filtres.site])

  // --- Recherche dans les commentaires ----------------------------------------

  // Le texte tape n'est envoye qu'au clic sur Rechercher ou a la touche Entree.
  // Si le filtre change ailleurs (bouton Reinitialiser), le champ suit.
  const [texteRecherche, setTexteRecherche] = useState(filtres.q ?? '')
  const [rechercheAppliquee, setRechercheAppliquee] = useState(filtres.q)
  if (rechercheAppliquee !== filtres.q) {
    setRechercheAppliquee(filtres.q)
    setTexteRecherche(filtres.q ?? '')
  }

  function envoyerRecherche(evenement: FormEvent<HTMLFormElement>): void {
    evenement.preventDefault()
    const texte = texteRecherche.trim()
    onChanger({ q: texte === '' ? undefined : texte })
  }

  // --- Periode ----------------------------------------------------------------

  // Si la date de debut passe apres la date de fin (ou l'inverse), l'autre date suit :
  // la periode reste toujours valide.
  function changerDebut(valeur: string): void {
    if (valeur === '') {
      onChanger({ from: undefined })
      return
    }
    const fin = filtres.to !== undefined && valeur > filtres.to ? valeur : filtres.to
    onChanger({ from: valeur, to: fin })
  }

  function changerFin(valeur: string): void {
    if (valeur === '') {
      onChanger({ to: undefined })
      return
    }
    const debut = filtres.from !== undefined && valeur < filtres.from ? valeur : filtres.from
    onChanger({ from: debut, to: valeur })
  }

  // --- Listes deroulantes -----------------------------------------------------

  const nomsSites = new Map(sites.map((site) => [site.id, site.nom]))

  const optionsStatuts: Option[] = STATUTS_AVIS.map((statut) => ({
    valeur: statut,
    libelle: t(cleTexteStatut(statut)),
  }))

  const optionsSites: Option[] = sites.map((site) => ({ valeur: site.id, libelle: site.nom }))

  // Sans site choisi, on ajoute le nom du site pour distinguer deux "Table 1".
  const optionsPoints: Option[] = pointsContact.map((point) => {
    const nomSite = nomsSites.get(point.site_id)
    const libelle =
      filtres.site === undefined && nomSite !== undefined ? `${point.nom} (${nomSite})` : point.nom
    return { valeur: point.id, libelle }
  })

  const optionsQuestionnaires: Option[] = questionnaires.map((questionnaire) => ({
    valeur: questionnaire.id,
    libelle:
      langue === 'en' ? (questionnaire.titre.en ?? questionnaire.titre.fr) : questionnaire.titre.fr,
  }))

  // --- Filtre sur les notes (vient d'un clic sur un graphique de l'accueil) ----

  const notesFiltrees = filtres.note_min !== undefined || filtres.note_max !== undefined
  const noteMin = filtres.note_min ?? 1
  const noteMax = filtres.note_max ?? 5
  const texteNotes =
    noteMin === noteMax
      ? t('avis.filtres.noteUnique', { note: formaterNombre(noteMin, langue) })
      : t('avis.filtres.trancheNotes', {
          min: formaterNombre(noteMin, langue),
          max: formaterNombre(noteMax, langue),
        })

  return (
    <section aria-labelledby={idTitre} className="rounded-lg bg-surface/50 p-5 sm:p-6">
      <h2 id={idTitre} className="sr-only">
        {t('tableau.filtres.titre')}
      </h2>

      {/* Recherche dans les commentaires */}
      <form onSubmit={envoyerRecherche} role="search">
        <label htmlFor={idRecherche} className={CLASSES_ETIQUETTE}>
          {t('avis.filtres.recherche')}
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            id={idRecherche}
            type="search"
            value={texteRecherche}
            maxLength={LONGUEUR_MAX_RECHERCHE}
            placeholder={t('avis.filtres.recherchePlaceholder')}
            onChange={(evenement) => setTexteRecherche(evenement.target.value)}
            className={`${CLASSES_CHAMP} min-w-0 flex-1 placeholder:text-texte-discret`}
          />
          <button
            type="submit"
            className="min-h-11 rounded-md bg-principale px-4 text-sm font-medium text-texte-sur-principale transition-colors hover:opacity-90"
          >
            {t('avis.filtres.rechercher')}
          </button>
        </div>
      </form>

      {/* Periode, statut, site, point de contact, questionnaire */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ChampDate
          etiquette={t('tableau.filtres.du')}
          valeur={filtres.from ?? ''}
          onChanger={changerDebut}
        />
        <ChampDate
          etiquette={t('tableau.filtres.au')}
          valeur={filtres.to ?? ''}
          onChanger={changerFin}
        />
        <Selecteur
          etiquette={t('avis.filtres.statut')}
          valeur={filtres.statut ?? ''}
          toutes={t('avis.filtres.tousLesStatuts')}
          options={optionsStatuts}
          onChanger={(statut) => {
            onChanger({ statut: STATUTS_AVIS.find((possible) => possible === statut) })
          }}
        />
        <Selecteur
          etiquette={t('tableau.filtres.site')}
          valeur={filtres.site ?? ''}
          toutes={t('tableau.filtres.tousLesSites')}
          options={optionsSites}
          onChanger={(site) => onChanger({ site: site === '' ? undefined : site })}
        />
        <Selecteur
          etiquette={t('tableau.filtres.point')}
          valeur={filtres.point ?? ''}
          toutes={t('tableau.filtres.tousLesPoints')}
          options={optionsPoints}
          onChanger={(point) => onChanger({ point: point === '' ? undefined : point })}
        />
        <Selecteur
          etiquette={t('tableau.filtres.questionnaire')}
          valeur={filtres.questionnaire ?? ''}
          toutes={t('tableau.filtres.tousLesQuestionnaires')}
          options={optionsQuestionnaires}
          onChanger={(questionnaire) => {
            onChanger({ questionnaire: questionnaire === '' ? undefined : questionnaire })
          }}
        />
      </div>

      {/* Avis negatifs, avis avec commentaire, tranche de notes */}
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1">
        <CaseACocher
          etiquette={t('avis.filtres.negatifs')}
          cochee={filtres.negatifs === true}
          onChanger={(cochee) => onChanger({ negatifs: cochee ? true : undefined })}
        />
        <CaseACocher
          etiquette={t('avis.filtres.avecCommentaire')}
          cochee={filtres.avec_commentaire === true}
          onChanger={(cochee) => onChanger({ avec_commentaire: cochee ? true : undefined })}
        />
        {notesFiltrees && (
          <div className="inline-flex min-h-11 items-center gap-1 rounded-full border border-bordure-champ bg-surface pl-3 text-sm text-texte">
            <span>{texteNotes}</span>
            <button
              type="button"
              aria-label={t('avis.filtres.retirerNotes')}
              onClick={() => onChanger({ note_min: undefined, note_max: undefined })}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-base hover:bg-fond-alt"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onReinitialiser}
          disabled={nombreFiltresActifs === 0}
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