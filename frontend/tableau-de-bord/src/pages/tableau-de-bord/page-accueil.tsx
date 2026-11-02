import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AvisRecents } from '../../composants-tableau/avis-recents'
import { BarreFiltres } from '../../composants-tableau/barre-filtres'
import { CarteAccueil } from '../../composants-tableau/carte-accueil'
import type { VariationAccueil } from '../../composants-tableau/carte-accueil'
import { DetailQuestions } from '../../composants-tableau/detail-questions'
import { GraphiqueCourbe } from '../../composants-tableau/graphique-courbe'
import { GraphiqueRepartition } from '../../composants-tableau/graphique-repartition'
import { GraphiqueThemes } from '../../composants-tableau/graphique-themes'
import {
  IconeAlertes,
  IconeAvisRecents,
  IconeClassement,
  IconeCourbe,
  IconeFiltres,
  IconeNoteMoyenne,
  IconeNombreAvis,
  IconeQuestions,
  IconeRecommandation,
  IconeRepartition,
  IconeSatisfaction,
  IconeTauxReponse,
  IconeThemes,
} from '../../composants-tableau/icones-accueil'
import type { ComposantIcone } from '../../composants-tableau/icones-accueil'
import { BoutonFermer, DetailCarte, PanneauDetail } from '../../composants-tableau/panneau-detail'
import { TableauClassement } from '../../composants-tableau/tableau-classement'
import { utiliserDonneesTableau } from '../../hooks/utiliser-donnees-tableau'
import { utiliserLangue } from '../../hooks/utiliser-langue'
import { utiliserUtilisateur } from '../../hooks/utiliser-utilisateur'
import { construireLienAvis } from '../../services/tableau-de-bord'
import '../../styles/accueil.css'
import type { Langue } from '../../types/langue'
import type { ChoixPeriode, FiltresApi, ReponseKpis } from '../../types/tableau-de-bord'
import type { ValeursTexte } from '../../traductions/contexte-langue'
import { cleTexteNiveau, niveauDeLaNote } from '../../utilitaires/couleurs-notes'
import type { NiveauNote } from '../../utilitaires/couleurs-notes'
import { formaterHeure, formaterJour } from '../../utilitaires/periodes'

// Ecran E7 : page d'accueil du tableau de bord.
// Disposition du tableau de bord de Gestion Scolaire : on ne voit d'abord que l'en-tete, le bouton
// Filtres et trois cartes. Le reste (detail d'une carte, filtres, graphiques, classement...) s'ouvre
// au clic dans UN SEUL panneau : ouvrir autre chose remplace ce qui est ouvert.
// Sur grand ecran (voir styles/accueil.css), la page a la hauteur de l'ecran et ne defile pas :
// quand le panneau est ouvert, la racine prend la classe accueil--ouvert, l'en-tete et les cartes se
// compactent et le panneau prend toute la hauteur qui reste.
// Les donnees, les filtres et l'actualisation toutes les 10 secondes viennent de utiliserDonneesTableau.

// Duree de la sortie d'un groupe de cartes (doit rester egale a celle du CSS)
const DUREE_SORTIE_MS = 230
// A partir de cette anciennete (en heures), on ecrit la duree en jours
const SEUIL_JOURS_HEURES = 48
const ID_PANNEAU = 'accueil-panneau'

type Traduire = (cle: string, valeurs?: ValeursTexte) => string

// ------------------------------------------------------------
// Les six cartes
// ------------------------------------------------------------

type CleCarte = 'noteMoyenne' | 'csat' | 'nps' | 'nbAvis' | 'tauxReponse' | 'alertes'

// Deux groupes de trois cartes, avec fleches et points pour passer de l'un a l'autre
const GROUPES: CleCarte[][] = [
  ['noteMoyenne', 'csat', 'nps'],
  ['nbAvis', 'tauxReponse', 'alertes'],
]

type DefinitionCarte = {
  cle: CleCarte
  titre: string
  Icone: ComposantIcone
  couleur: string
  valeur: number | null
  decimales: number
  fixe: boolean
  unite?: string
  pastille?: number
  etiquette?: string
  sousTitre?: string
  variation?: VariationAccueil
  // Texte du panneau
  description: string
  aide?: string
  lien: string
}

const COULEUR_NIVEAU: Record<NiveauNote, string> = {
  bonne: 'var(--note-bonne)',
  moyenne: 'var(--note-moyenne)',
  mauvaise: 'var(--note-mauvaise)',
}

const COULEUR_DEFAUT = 'var(--couleur-principale)'

// Phrase sous le nombre d'alertes : "Aucune alerte" ou l'anciennete de la plus vieille
function aideDesAlertes(kpis: ReponseKpis, t: Traduire): string | undefined {
  const alertes = kpis.alertes_ouvertes
  if (alertes.nombre === 0) {
    return t('tableau.cartes.alertesAucune')
  }
  if (alertes.anciennete_max_heures === null) {
    return undefined
  }
  const heures = alertes.anciennete_max_heures
  const duree =
    heures >= SEUIL_JOURS_HEURES
      ? t('tableau.cartes.dureeJours', { nombre: Math.floor(heures / 24) })
      : t('tableau.cartes.dureeHeures', { nombre: Math.max(1, Math.round(heures)) })
  return t('tableau.cartes.alertesPlusAncienne', { duree })
}

// Construit les six cartes a partir des vrais chiffres de l'API.
// Les liens sont ceux de l'ancienne page : meme filtres, meme liste d'avis.
function construireCartes(
  kpis: ReponseKpis,
  filtres: FiltresApi | null,
  t: Traduire,
): Record<CleCarte, DefinitionCarte> {
  const { indicateurs, evolution } = kpis
  const base = filtres ?? {}
  const points = t('tableau.cartes.evolution.points')
  const niveau = niveauDeLaNote(indicateurs.note_moyenne)
  const aideAlertes = aideDesAlertes(kpis, t)
  const lienTous = construireLienAvis(base)

  return {
    noteMoyenne: {
      cle: 'noteMoyenne',
      titre: t('tableau.cartes.noteMoyenne'),
      Icone: IconeNoteMoyenne,
      couleur: niveau === null ? COULEUR_DEFAUT : COULEUR_NIVEAU[niveau],
      valeur: indicateurs.note_moyenne,
      decimales: 2,
      fixe: true,
      unite: '/ 5',
      etiquette: niveau === null ? undefined : t(cleTexteNiveau(niveau)),
      variation: { valeur: evolution.note_moyenne.difference, unite: '', decimales: 2 },
      description: t('tableau.accueil.descriptions.noteMoyenne'),
      aide: t('tableau.cartes.legendeNote'),
      lien: lienTous,
    },
    csat: {
      cle: 'csat',
      titre: t('tableau.cartes.csat'),
      Icone: IconeSatisfaction,
      couleur: 'var(--carte-bleu)',
      valeur: indicateurs.csat,
      decimales: 1,
      fixe: false,
      unite: '%',
      variation: { valeur: evolution.csat.difference, unite: points, decimales: 1 },
      description: t('tableau.accueil.descriptions.csat'),
      aide: t('tableau.cartes.csatAide'),
      lien: construireLienAvis(base, { note_min: 4 }),
    },
    nps: {
      cle: 'nps',
      titre: t('tableau.cartes.nps'),
      Icone: IconeRecommandation,
      couleur: 'var(--carte-violet)',
      valeur: indicateurs.nps,
      decimales: 1,
      fixe: false,
      variation: { valeur: evolution.nps.difference, unite: points, decimales: 1 },
      description: t('tableau.accueil.descriptions.nps'),
      aide: t('tableau.cartes.npsAide', {
        promoteurs: indicateurs.nb_promoteurs,
        detracteurs: indicateurs.nb_detracteurs,
      }),
      lien: lienTous,
    },
    nbAvis: {
      cle: 'nbAvis',
      titre: t('tableau.cartes.nbAvis'),
      Icone: IconeNombreAvis,
      couleur: COULEUR_DEFAUT,
      valeur: indicateurs.nb_avis,
      decimales: 0,
      fixe: false,
      variation: { valeur: evolution.nb_avis.pourcentage, unite: '%', decimales: 1 },
      description: t('tableau.accueil.descriptions.nbAvis'),
      aide: t('tableau.cartes.nbAvisAide', { scans: indicateurs.nb_scans }),
      lien: lienTous,
    },
    tauxReponse: {
      cle: 'tauxReponse',
      titre: t('tableau.cartes.tauxReponse'),
      Icone: IconeTauxReponse,
      couleur: 'var(--carte-sarcelle)',
      valeur: indicateurs.taux_reponse,
      decimales: 1,
      fixe: false,
      unite: '%',
      variation: { valeur: evolution.taux_reponse.difference, unite: points, decimales: 1 },
      description: t('tableau.accueil.descriptions.tauxReponse'),
      aide: t('tableau.cartes.tauxReponseAide'),
      lien: lienTous,
    },
    alertes: {
      cle: 'alertes',
      titre: t('tableau.cartes.alertes'),
      Icone: IconeAlertes,
      couleur: kpis.alertes_ouvertes.nombre > 0 ? 'var(--erreur)' : 'var(--succes)',
      valeur: kpis.alertes_ouvertes.nombre,
      decimales: 0,
      fixe: false,
      pastille: kpis.alertes_ouvertes.nombre,
      // Pas de comparaison pour les alertes : la ligne du bas dit l'anciennete de la plus vieille
      sousTitre: aideAlertes,
      description: t('tableau.accueil.descriptions.alertes'),
      aide: aideAlertes,
      lien: construireLienAvis(base, { from: undefined, to: undefined, negatifs: true }),
    },
  }
}

// ------------------------------------------------------------
// Les six icones de raccourci (et le bouton Filtres, qui ouvre le meme panneau)
// ------------------------------------------------------------

type CleSection =
  | 'filtres'
  | 'repartition'
  | 'themes'
  | 'courbe'
  | 'classement'
  | 'avisRecents'
  | 'questions'

type Raccourci = {
  cle: CleSection
  Icone: ComposantIcone
  // Cle du titre, deja ecrit dans les traductions (titre de la section)
  cleTitre: string
}

const RACCOURCIS_HAUT: Raccourci[] = [
  { cle: 'repartition', Icone: IconeRepartition, cleTitre: 'tableau.repartition.titre' },
  { cle: 'themes', Icone: IconeThemes, cleTitre: 'tableau.themes.titre' },
  { cle: 'courbe', Icone: IconeCourbe, cleTitre: 'tableau.courbe.titre' },
]

const RACCOURCIS_DROITE: Raccourci[] = [
  { cle: 'classement', Icone: IconeClassement, cleTitre: 'tableau.classement.titre' },
  { cle: 'avisRecents', Icone: IconeAvisRecents, cleTitre: 'tableau.avisRecents.titre' },
  { cle: 'questions', Icone: IconeQuestions, cleTitre: 'tableau.questions.titre' },
]

// Ce que le panneau montre : le detail d'une carte, ou une section (filtres compris)
type Selection = { type: 'carte'; cle: CleCarte } | { type: 'section'; cle: CleSection }

function memeSelection(a: Selection | null, b: Selection): boolean {
  return a !== null && a.type === b.type && a.cle === b.cle
}

// Cle du texte du titre de la periode : "Du ... au ...", ou "Aujourd'hui, ..." / "Le ..." quand elle tient en un seul jour
function cleTitrePeriode(periode: { from: string; to: string }, choix: ChoixPeriode): string {
  if (periode.from !== periode.to) {
    return 'tableau.periodeAffichee'
  }
  return choix === 'aujourdhui' ? 'tableau.periodeAujourdhui' : 'tableau.periodeUnJour'
}

// Date du jour ecrite en toutes lettres : "dimanche 1 novembre 2026"
function dateDuJour(date: Date, langue: Langue): string {
  return new Intl.DateTimeFormat(langue === 'en' ? 'en-GB' : 'fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

export function PageAccueil() {
  const { t, langue } = utiliserLangue()
  const { utilisateur } = utiliserUtilisateur()
  const {
    filtres,
    changerFiltres,
    reinitialiserFiltres,
    erreurPeriode,
    donnees,
    filtresAffiches,
    chargementInitial,
    actualisationEnCours,
    erreur,
    derniereMiseAJour,
    actualiser,
    sites,
    pointsContact,
    questionnaires,
    erreurListes,
  } = utiliserDonneesTableau()

  const [aujourdhui] = useState(() => new Date())

  // Groupe de cartes affiche, et phase de l'animation de passage d'un groupe a l'autre
  const [indexGroupe, setIndexGroupe] = useState(0)
  const [phase, setPhase] = useState<'repos' | 'sortie' | 'entree'>('repos')
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Contenu du panneau (il garde son contenu pendant la fermeture animee)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [ouvert, setOuvert] = useState(false)

  // Au moins un filtre est different de ceux par defaut (les memes que dans BarreFiltres)
  const filtresModifies =
    filtres.periode !== '30jours' ||
    filtres.site !== '' ||
    filtres.point !== '' ||
    filtres.questionnaire !== ''

  useEffect(
    () => () => {
      if (minuterie.current !== null) {
        clearTimeout(minuterie.current)
      }
    },
    [],
  )

  const cleSelection = selection === null ? '' : `${selection.type}-${selection.cle}`

  function afficherGroupe(index: number) {
    if (index === indexGroupe || phase !== 'repos') {
      return
    }
    setPhase('sortie')
    // Le detail d'une carte du groupe qui part n'a plus de carte a montrer : on le ferme
    if (selection?.type === 'carte') {
      setOuvert(false)
    }
    minuterie.current = setTimeout(() => {
      setIndexGroupe(index)
      setPhase('entree')
      requestAnimationFrame(() => requestAnimationFrame(() => setPhase('repos')))
    }, DUREE_SORTIE_MS)
  }

  function changerDeGroupe(direction: -1 | 1) {
    afficherGroupe((indexGroupe + direction + GROUPES.length) % GROUPES.length)
  }

  // Un clic ouvre le panneau ; un second clic sur le meme element le referme.
  // Un seul panneau a la fois : ouvrir autre chose remplace le contenu.
  function choisir(nouvelle: Selection) {
    if (ouvert && memeSelection(selection, nouvelle)) {
      setOuvert(false)
      return
    }
    setSelection(nouvelle)
    setOuvert(true)
  }

  function fermer() {
    setOuvert(false)
  }

  function sectionOuverte(cle: CleSection): boolean {
    return ouvert && selection?.type === 'section' && selection.cle === cle
  }

  function boutonRaccourci(raccourci: Raccourci) {
    const { cle, Icone, cleTitre } = raccourci
    const titre = t(cleTitre)
    return (
      <button
        key={cle}
        type="button"
        className="accueil-icone-coin"
        aria-label={titre}
        aria-pressed={sectionOuverte(cle)}
        aria-controls={ID_PANNEAU}
        onClick={() => choisir({ type: 'section', cle })}
      >
        <Icone aria-hidden="true" />
        <span className="accueil-infobulle" aria-hidden="true">
          {titre}
        </span>
      </button>
    )
  }

  // Contenu d'une section : les composants deja ecrits, avec leurs liens, leurs erreurs et leur actualisation
  function contenuSection(cle: CleSection): ReactNode {
    // Les filtres ne dependent pas des donnees : on peut les changer meme avant le premier chargement
    if (cle === 'filtres') {
      return (
        <BarreFiltres
          filtres={filtres}
          onChanger={changerFiltres}
          onReinitialiser={reinitialiserFiltres}
          erreurPeriode={erreurPeriode}
          sites={sites}
          pointsContact={pointsContact}
          questionnaires={questionnaires}
          erreurListes={erreurListes}
        />
      )
    }
    if (donnees === null) {
      return <p className="accueil-message">{t('tableau.chargement')}</p>
    }
    switch (cle) {
      case 'repartition':
        return (
          <GraphiqueRepartition
            repartition={donnees.kpis.indicateurs.repartition_notes}
            filtres={filtresAffiches}
          />
        )
      case 'themes':
        return <GraphiqueThemes themes={donnees.themes.themes} />
      case 'courbe':
        return <GraphiqueCourbe points={donnees.serie.points} filtres={filtresAffiches} />
      case 'classement':
        return (
          <TableauClassement lignes={donnees.classement.points_contact} filtres={filtresAffiches} />
        )
      case 'avisRecents':
        return <AvisRecents avis={donnees.derniersAvis.avis} filtres={filtresAffiches} />
      case 'questions':
        return <DetailQuestions questions={donnees.questions.questions} questionnaires={questionnaires} />
    }
  }

  const cartes =
    donnees === null ? null : construireCartes(donnees.kpis, filtresAffiches, t)

  // Contenu du panneau selon la selection courante
  function contenuPanneau(): ReactNode {
    if (selection === null) {
      return null
    }
    if (selection.type === 'section') {
      return (
        <>
          <div className="accueil-section-fermer">
            <BoutonFermer onFermer={fermer} />
          </div>
          {contenuSection(selection.cle)}
        </>
      )
    }
    const carte = cartes?.[selection.cle]
    if (carte === undefined) {
      return null
    }
    return (
      <DetailCarte
        titre={carte.titre}
        description={carte.description}
        variation={carte.variation}
        aide={carte.aide}
        lien={carte.lien}
        onFermer={fermer}
      />
    )
  }

  const groupeActif = GROUPES[indexGroupe]
  const classesGroupe = [
    'accueil-groupe',
    phase === 'sortie' ? 'accueil-groupe--sortie' : '',
    phase === 'entree' ? 'accueil-groupe--entree' : '',
  ]
    .filter((classe) => classe !== '')
    .join(' ')

  return (
    <div className={ouvert ? 'accueil accueil--ouvert' : 'accueil'}>
      <nav className="accueil-raccourcis" aria-label={t('tableau.accueil.raccourcis')}>
        {RACCOURCIS_HAUT.map(boutonRaccourci)}
        <div className="accueil-raccourcis-colonne">{RACCOURCIS_DROITE.map(boutonRaccourci)}</div>
      </nav>

      <section className="accueil-scene" aria-label={t('accueil.titre')}>
        <header className="accueil-titre">
          {utilisateur !== null && (
            <p className="accueil-salutation">{t('accueil.bonjour', { nom: utilisateur.nom })}</p>
          )}
          <p className="accueil-date">{dateDuJour(aujourdhui, langue)}</p>
          <h1 className="accueil-sous-titre">
            {donnees === null
              ? t('accueil.titre')
              : t(cleTitrePeriode(donnees.kpis.periode, filtres.periode), {
                  debut: formaterJour(donnees.kpis.periode.from, langue),
                  fin: formaterJour(donnees.kpis.periode.to, langue),
                })}
          </h1>

          {donnees !== null && (
            <div className="accueil-meta">
              {derniereMiseAJour !== null && (
                <p>{t('tableau.misAJour', { heure: formaterHeure(derniereMiseAJour, langue) })}</p>
              )}
              <p className="accueil-meta-auto">{t('tableau.actualisationAuto')}</p>
              <button
                type="button"
                className="accueil-bouton-actualiser"
                onClick={actualiser}
                disabled={actualisationEnCours}
              >
                {actualisationEnCours ? t('tableau.actualisationEnCours') : t('tableau.actualiser')}
              </button>
            </div>
          )}

          {utilisateur !== null && utilisateur.role === 'GESTIONNAIRE' && (
            <p className="accueil-meta accueil-meta--perimetre">{t('tableau.perimetreGestionnaire')}</p>
          )}
        </header>

        {chargementInitial && (
          <p role="status" className="accueil-message">
            {t('tableau.chargement')}
          </p>
        )}

        {erreur !== null && donnees === null && (
          <div role="alert" className="accueil-message accueil-message--erreur">
            <p>{erreur.statut === 0 ? t('commun.erreurReseau') : t('tableau.erreur')}</p>
            <button type="button" className="accueil-bouton-actualiser" onClick={actualiser}>
              {t('commun.reessayer')}
            </button>
          </div>
        )}

        {erreur !== null && donnees !== null && (
          <p role="alert" className="accueil-message accueil-message--erreur">
            {t('tableau.erreurActualisation')}
          </p>
        )}

        {/* Le bouton Filtres ouvre le panneau unique, comme les icones en coin */}
        <div className="accueil-zone-filtres">
          <button
            type="button"
            className="accueil-filtres-bouton"
            aria-pressed={sectionOuverte('filtres')}
            aria-controls={ID_PANNEAU}
            onClick={() => choisir({ type: 'section', cle: 'filtres' })}
          >
            <IconeFiltres aria-hidden="true" />
            {t('tableau.filtres.titre')}
            {filtresModifies && <span className="accueil-filtres-point" aria-hidden="true" />}
          </button>
        </div>

        {cartes !== null && donnees !== null && (
          <>
            <section className="accueil-cartes" aria-live="polite">
              <div key={indexGroupe} className={classesGroupe}>
                {groupeActif.map((cle, rang) => {
                  const carte = cartes[cle]
                  return (
                    <CarteAccueil
                      key={cle}
                      titre={carte.titre}
                      Icone={carte.Icone}
                      couleur={carte.couleur}
                      valeur={carte.valeur}
                      decimales={carte.decimales}
                      fixe={carte.fixe}
                      unite={carte.unite}
                      pastille={carte.pastille}
                      etiquette={carte.etiquette}
                      sousTitre={carte.sousTitre}
                      variation={carte.variation}
                      active={ouvert && selection?.type === 'carte' && selection.cle === cle}
                      idPanneau={ID_PANNEAU}
                      rang={rang}
                      onClick={() => choisir({ type: 'carte', cle })}
                    />
                  )
                })}
              </div>
            </section>

            <div className="accueil-controles">
              <button
                type="button"
                className="accueil-fleche"
                onClick={() => changerDeGroupe(-1)}
                aria-label={t('tableau.accueil.groupePrecedent')}
              >
                ←
              </button>
              <div className="accueil-points" role="group" aria-label={t('tableau.accueil.groupes')}>
                {GROUPES.map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    className={`accueil-point ${index === indexGroupe ? 'accueil-point--actif' : ''}`}
                    aria-label={t('tableau.accueil.groupeAller', { numero: index + 1 })}
                    aria-current={index === indexGroupe ? 'true' : undefined}
                    onClick={() => afficherGroupe(index)}
                  />
                ))}
              </div>
              <button
                type="button"
                className="accueil-fleche"
                onClick={() => changerDeGroupe(1)}
                aria-label={t('tableau.accueil.groupeSuivant')}
              >
                →
              </button>
            </div>
            <p className="accueil-compteur">
              {t('tableau.accueil.groupeSur', { numero: indexGroupe + 1, total: GROUPES.length })}
            </p>

            {donnees.kpis.indicateurs.nb_avis === 0 && (
              <p className="accueil-message" style={{ marginTop: 16 }}>
                {t('tableau.aucunAvis')}
              </p>
            )}
          </>
        )}

        {/* Le panneau unique doit rester le dernier enfant direct de .accueil-scene (le CSS cible .accueil-scene > .accueil-panneau) */}
        <PanneauDetail
          id={ID_PANNEAU}
          ouvert={ouvert}
          large={selection?.type === 'section'}
          cleContenu={cleSelection}
        >
          {contenuPanneau()}
        </PanneauDetail>
      </section>
    </div>
  )
}