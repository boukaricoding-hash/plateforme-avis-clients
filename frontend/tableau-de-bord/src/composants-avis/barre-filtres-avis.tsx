import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { IconeNoteMoyenne } from '../composants-tableau/icones-accueil'
import type { ComposantIcone } from '../composants-tableau/icones-accueil'
import type { ModificationsFiltresAvis } from '../hooks/utiliser-filtres-avis'
import { utiliserLangue } from '../hooks/utiliser-langue'
import { IconeChevron } from '../mise-en-page/icones-menu'
import type { ParametresListeAvis } from '../services/avis'
import { lirePointsContact, lireQuestionnaires, lireSites } from '../services/tableau-de-bord'
import type {
  PointContactFiltre,
  QuestionnaireFiltre,
  SiteFiltre,
} from '../types/tableau-de-bord'
import { formaterJourCourt, formaterNombre } from '../utilitaires/periodes'
import { cleTexteStatut, STATUTS_AVIS } from '../utilitaires/statuts-avis'
import {
  IconeActualiser,
  IconeCalendrier,
  IconeCoche,
  IconeDocument,
  IconeEpingle,
  IconeFiltresStatut,
  IconeFlecheDroite,
  IconeRecherche,
  IconeTable,
} from './icones-avis'

// Barre de filtres de la page des avis (jour 15 design) : une seule ligne avec la recherche dans
// les commentaires, des pastilles qui ouvrent un petit menu (periode, note, site, point de
// contact, questionnaire, statut), le bouton d'actualisation et le bouton de recherche.
// Les filtres eux-memes vivent dans l'adresse de la page (hook utiliserFiltresAvis) :
// cette barre les affiche et demande les changements. Elle charge seulement les listes
// de sites, de points de contact et de questionnaires.
// Un seul menu est ouvert a la fois. Il se ferme avec Echap, avec un clic ou un focus ailleurs.
// Le style vient de styles/avis.css (classes avis-barre, avis-pastille-filtre, avis-menu...).

const LONGUEUR_MAX_RECHERCHE = 100
// Tranches de notes proposees dans le menu Note, de la meilleure a la moins bonne
const TRANCHES_NOTES: readonly (readonly [number, number])[] = [
  [4, 5],
  [3, 4],
  [2, 3],
  [1, 2],
]

type NomMenu = 'periode' | 'note' | 'site' | 'point' | 'questionnaire' | 'statut'

type Option = { valeur: string; libelle: string }

// ------------------------------------------------------------
// Petits composants des menus
// ------------------------------------------------------------

type PropsOptionMenu = {
  libelle: string
  choisie: boolean
  onChoisir: () => void
}

function OptionMenu({ libelle, choisie, onChoisir }: PropsOptionMenu) {
  return (
    <button
      type="button"
      aria-pressed={choisie}
      onClick={onChoisir}
      className={`avis-menu-option${choisie ? ' avis-menu-option--choisie' : ''}`}
    >
      <span className="truncate">{libelle}</span>
      {choisie && <IconeCoche width={16} height={16} />}
    </button>
  )
}

type PropsMenuListe = {
  // Premier choix, qui retire le filtre ("Tous les sites")
  toutes: string
  valeurChoisie: string
  options: Option[]
  onChoisir: (valeur: string) => void
}

function MenuListe({ toutes, valeurChoisie, options, onChoisir }: PropsMenuListe) {
  return (
    <ul className="m-0 list-none p-0">
      <li>
        <OptionMenu libelle={toutes} choisie={valeurChoisie === ''} onChoisir={() => onChoisir('')} />
      </li>
      {options.map((option) => (
        <li key={option.valeur}>
          <OptionMenu
            libelle={option.libelle}
            choisie={valeurChoisie === option.valeur}
            onChoisir={() => onChoisir(option.valeur)}
          />
        </li>
      ))}
    </ul>
  )
}

type PropsCaseMenu = {
  etiquette: string
  cochee: boolean
  onChanger: (cochee: boolean) => void
}

function CaseMenu({ etiquette, cochee, onChanger }: PropsCaseMenu) {
  const id = useId()
  return (
    <div className="flex min-h-10 items-center gap-2 px-2">
      <input
        id={id}
        type="checkbox"
        checked={cochee}
        onChange={(evenement) => onChanger(evenement.target.checked)}
        className="h-4 w-4"
        style={{ accentColor: 'var(--v-accent)' }}
      />
      <label htmlFor={id} className="text-sm text-texte">
        {etiquette}
      </label>
    </div>
  )
}

type PropsMenuPeriode = {
  debut: string
  fin: string
  onChangerDebut: (valeur: string) => void
  onChangerFin: (valeur: string) => void
  onEffacer: () => void
}

function MenuPeriode({ debut, fin, onChangerDebut, onChangerFin, onEffacer }: PropsMenuPeriode) {
  const { t } = utiliserLangue()
  const idDebut = useId()
  const idFin = useId()
  const periodeChoisie = debut !== '' || fin !== ''

  return (
    <div>
      <label htmlFor={idDebut} className="avis-menu-etiquette">
        {t('tableau.filtres.du')}
      </label>
      <input
        id={idDebut}
        type="date"
        value={debut}
        onChange={(evenement) => onChangerDebut(evenement.target.value)}
        className="avis-menu-champ"
      />
      <label htmlFor={idFin} className="avis-menu-etiquette">
        {t('tableau.filtres.au')}
      </label>
      <input
        id={idFin}
        type="date"
        value={fin}
        onChange={(evenement) => onChangerFin(evenement.target.value)}
        className="avis-menu-champ"
      />
      {periodeChoisie && (
        <div className="mt-2">
          <OptionMenu libelle={t('avis.filtres.toutesLesDates')} choisie={false} onChoisir={onEffacer} />
        </div>
      )}
    </div>
  )
}

type PropsPastilleFiltre = {
  nom: NomMenu
  ouvert: boolean
  Icone: ComposantIcone
  // Texte de la pastille : le nom du filtre, ou le choix fait
  libelle: string
  // Vrai quand un filtre de ce menu est en place : la pastille prend la couleur d'accent
  active: boolean
  // Le menu s'ouvre vers la gauche (pastilles proches du bord droit)
  aDroite?: boolean
  onBasculer: (nom: NomMenu) => void
  children: ReactNode
}

// Une pastille et son menu. L'attribut data-menu-avis sert a savoir si un clic est dans le menu.
function PastilleFiltre({
  nom,
  ouvert,
  Icone,
  libelle,
  active,
  aDroite = false,
  onBasculer,
  children,
}: PropsPastilleFiltre) {
  const idMenu = useId()

  return (
    <div className="avis-menu-zone" data-menu-avis={nom}>
      <button
        type="button"
        aria-expanded={ouvert}
        aria-controls={ouvert ? idMenu : undefined}
        onClick={() => onBasculer(nom)}
        className={`avis-pastille-filtre${active ? ' avis-pastille-filtre--active' : ''}`}
      >
        <Icone width={18} height={18} />
        <span className="max-w-36 truncate">{libelle}</span>
        <IconeChevron width={14} height={14} />
      </button>
      {ouvert && (
        <div
          id={idMenu}
          className="avis-menu"
          style={aDroite ? { left: 'auto', right: 0 } : undefined}
        >
          {children}
        </div>
      )}
    </div>
  )
}

// ------------------------------------------------------------
// La barre
// ------------------------------------------------------------

type Proprietes = {
  filtres: ParametresListeAvis
  nombreFiltresActifs: number
  onChanger: (modifications: ModificationsFiltresAvis) => void
  onReinitialiser: () => void
  onActualiser: () => void
  actualisationEnCours: boolean
}

export function BarreFiltresAvis({
  filtres,
  nombreFiltresActifs,
  onChanger,
  onReinitialiser,
  onActualiser,
  actualisationEnCours,
}: Proprietes) {
  const { t, langue } = utiliserLangue()
  const idRecherche = useId()
  const refBarre = useRef<HTMLFormElement>(null)
  const [menuOuvert, setMenuOuvert] = useState<NomMenu | null>(null)

  // --- Ouverture et fermeture des menus ---------------------------------------

  function basculerMenu(nom: NomMenu): void {
    setMenuOuvert((actuel) => (actuel === nom ? null : nom))
  }

  function fermerMenu(): void {
    setMenuOuvert(null)
  }

  // Menu ouvert : un clic ou un focus en dehors le ferme, Echap aussi (le focus revient a la pastille).
  useEffect(() => {
    if (menuOuvert === null) {
      return
    }
    const selecteur = `[data-menu-avis="${menuOuvert}"]`

    function dansLeMenu(cible: EventTarget | null): boolean {
      return cible instanceof Element && cible.closest(selecteur) !== null
    }
    function surClic(evenement: PointerEvent): void {
      if (!dansLeMenu(evenement.target)) {
        setMenuOuvert(null)
      }
    }
    function surFocus(evenement: FocusEvent): void {
      if (!dansLeMenu(evenement.target)) {
        setMenuOuvert(null)
      }
    }
    function surTouche(evenement: KeyboardEvent): void {
      if (evenement.key === 'Escape') {
        setMenuOuvert(null)
        refBarre.current?.querySelector<HTMLButtonElement>(`${selecteur} > button`)?.focus()
      }
    }

    document.addEventListener('pointerdown', surClic)
    document.addEventListener('focusin', surFocus)
    document.addEventListener('keydown', surTouche)
    return () => {
      document.removeEventListener('pointerdown', surClic)
      document.removeEventListener('focusin', surFocus)
      document.removeEventListener('keydown', surTouche)
    }
  }, [menuOuvert])

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

  // Le texte tape n'est envoye qu'au clic sur la fleche ou a la touche Entree.
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

  const periodeActive = filtres.from !== undefined || filtres.to !== undefined
  const libellePeriode = periodeActive
    ? `${filtres.from === undefined ? '…' : formaterJourCourt(filtres.from, langue)} – ${filtres.to === undefined ? '…' : formaterJourCourt(filtres.to, langue)}`
    : t('tableau.filtres.periode')

  // --- Notes (tranche choisie ici, ou venue d'un clic sur un graphique de l'accueil) ----

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

  function titreQuestionnaire(questionnaire: QuestionnaireFiltre): string {
    return langue === 'en' ? (questionnaire.titre.en ?? questionnaire.titre.fr) : questionnaire.titre.fr
  }

  const optionsQuestionnaires: Option[] = questionnaires.map((questionnaire) => ({
    valeur: questionnaire.id,
    libelle: titreQuestionnaire(questionnaire),
  }))

  // Texte de chaque pastille : le choix fait, sinon le nom du filtre.
  const libelleSite =
    filtres.site === undefined
      ? t('tableau.filtres.site')
      : (nomsSites.get(filtres.site) ?? t('tableau.filtres.site'))
  const libellePoint =
    pointsContact.find((point) => point.id === filtres.point)?.nom ?? t('tableau.filtres.point')
  const questionnaireChoisi = questionnaires.find(
    (questionnaire) => questionnaire.id === filtres.questionnaire,
  )
  const libelleQuestionnaire =
    questionnaireChoisi === undefined
      ? t('tableau.filtres.questionnaire')
      : titreQuestionnaire(questionnaireChoisi)
  const libelleStatut =
    filtres.statut === undefined ? t('avis.filtres.statut') : t(cleTexteStatut(filtres.statut))
  const statutActif =
    filtres.statut !== undefined || filtres.negatifs === true || filtres.avec_commentaire === true

  return (
    <form
      ref={refBarre}
      role="search"
      aria-label={t('tableau.filtres.titre')}
      onSubmit={envoyerRecherche}
      className="avis-barre"
    >
      {/* Recherche dans les commentaires */}
      <div className="avis-recherche">
        <IconeRecherche width={20} height={20} />
        <label htmlFor={idRecherche} className="sr-only">
          {t('avis.filtres.recherche')}
        </label>
        <input
          id={idRecherche}
          type="search"
          value={texteRecherche}
          maxLength={LONGUEUR_MAX_RECHERCHE}
          placeholder={t('avis.filtres.recherchePlaceholder')}
          onChange={(evenement) => setTexteRecherche(evenement.target.value)}
        />
      </div>

      <div className="avis-separateur hidden lg:block" aria-hidden="true" />

      <PastilleFiltre
        nom="periode"
        ouvert={menuOuvert === 'periode'}
        Icone={IconeCalendrier}
        libelle={libellePeriode}
        active={periodeActive}
        onBasculer={basculerMenu}
      >
        <MenuPeriode
          debut={filtres.from ?? ''}
          fin={filtres.to ?? ''}
          onChangerDebut={changerDebut}
          onChangerFin={changerFin}
          onEffacer={() => {
            onChanger({ from: undefined, to: undefined })
            fermerMenu()
          }}
        />
      </PastilleFiltre>

      <PastilleFiltre
        nom="note"
        ouvert={menuOuvert === 'note'}
        Icone={IconeNoteMoyenne}
        libelle={notesFiltrees ? texteNotes : t('avis.filtres.note')}
        active={notesFiltrees}
        onBasculer={basculerMenu}
      >
        <ul className="m-0 list-none p-0">
          <li>
            <OptionMenu
              libelle={t('avis.filtres.toutesLesNotes')}
              choisie={!notesFiltrees}
              onChoisir={() => {
                onChanger({ note_min: undefined, note_max: undefined })
                fermerMenu()
              }}
            />
          </li>
          {TRANCHES_NOTES.map(([min, max]) => (
            <li key={`${min}-${max}`}>
              <OptionMenu
                libelle={t('avis.filtres.trancheNotes', {
                  min: formaterNombre(min, langue),
                  max: formaterNombre(max, langue),
                })}
                choisie={filtres.note_min === min && filtres.note_max === max}
                onChoisir={() => {
                  onChanger({ note_min: min, note_max: max })
                  fermerMenu()
                }}
              />
            </li>
          ))}
        </ul>
      </PastilleFiltre>

      <PastilleFiltre
        nom="site"
        ouvert={menuOuvert === 'site'}
        Icone={IconeEpingle}
        libelle={libelleSite}
        active={filtres.site !== undefined}
        onBasculer={basculerMenu}
      >
        <MenuListe
          toutes={t('tableau.filtres.tousLesSites')}
          valeurChoisie={filtres.site ?? ''}
          options={optionsSites}
          onChoisir={(site) => {
            onChanger({ site: site === '' ? undefined : site })
            fermerMenu()
          }}
        />
      </PastilleFiltre>

      <PastilleFiltre
        nom="point"
        ouvert={menuOuvert === 'point'}
        Icone={IconeTable}
        libelle={libellePoint}
        active={filtres.point !== undefined}
        onBasculer={basculerMenu}
      >
        <MenuListe
          toutes={t('tableau.filtres.tousLesPoints')}
          valeurChoisie={filtres.point ?? ''}
          options={optionsPoints}
          onChoisir={(point) => {
            onChanger({ point: point === '' ? undefined : point })
            fermerMenu()
          }}
        />
      </PastilleFiltre>

      <PastilleFiltre
        nom="questionnaire"
        ouvert={menuOuvert === 'questionnaire'}
        Icone={IconeDocument}
        libelle={libelleQuestionnaire}
        active={filtres.questionnaire !== undefined}
        aDroite
        onBasculer={basculerMenu}
      >
        <MenuListe
          toutes={t('tableau.filtres.tousLesQuestionnaires')}
          valeurChoisie={filtres.questionnaire ?? ''}
          options={optionsQuestionnaires}
          onChoisir={(questionnaire) => {
            onChanger({ questionnaire: questionnaire === '' ? undefined : questionnaire })
            fermerMenu()
          }}
        />
      </PastilleFiltre>

      <PastilleFiltre
        nom="statut"
        ouvert={menuOuvert === 'statut'}
        Icone={IconeFiltresStatut}
        libelle={libelleStatut}
        active={statutActif}
        aDroite
        onBasculer={basculerMenu}
      >
        <MenuListe
          toutes={t('avis.filtres.tousLesStatuts')}
          valeurChoisie={filtres.statut ?? ''}
          options={optionsStatuts}
          onChoisir={(statut) => {
            onChanger({ statut: STATUTS_AVIS.find((possible) => possible === statut) })
            fermerMenu()
          }}
        />
        <div className="my-2 border-t border-bordure" />
        <CaseMenu
          etiquette={t('avis.filtres.negatifs')}
          cochee={filtres.negatifs === true}
          onChanger={(cochee) => onChanger({ negatifs: cochee ? true : undefined })}
        />
        <CaseMenu
          etiquette={t('avis.filtres.avecCommentaire')}
          cochee={filtres.avec_commentaire === true}
          onChanger={(cochee) => onChanger({ avec_commentaire: cochee ? true : undefined })}
        />
      </PastilleFiltre>

      {nombreFiltresActifs > 0 && (
        <button
          type="button"
          onClick={onReinitialiser}
          className="min-h-11 rounded-full px-3 text-sm font-medium text-texte-secondaire underline underline-offset-4 hover:text-texte"
        >
          {t('tableau.filtres.reinitialiser')}
        </button>
      )}

      <button
        type="button"
        onClick={onActualiser}
        disabled={actualisationEnCours}
        aria-label={actualisationEnCours ? t('tableau.actualisationEnCours') : t('tableau.actualiser')}
        title={t('tableau.actualiser')}
        className="avis-bouton-rond ml-auto"
      >
        <IconeActualiser className={actualisationEnCours ? 'motion-safe:animate-spin' : undefined} />
      </button>

      <button type="submit" aria-label={t('avis.filtres.rechercher')} className="avis-bouton-accent">
        <IconeFlecheDroite width={20} height={20} />
      </button>

      {erreurListes && (
        <p role="alert" className="basis-full px-2 text-sm text-erreur">
          {t('tableau.filtres.erreurListes')}
        </p>
      )}
    </form>
  )
}