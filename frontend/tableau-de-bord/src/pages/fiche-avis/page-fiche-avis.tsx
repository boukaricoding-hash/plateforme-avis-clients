import type { ReactNode } from 'react'
import { Link, Navigate, useLocation, useParams } from 'react-router'
import { HistoriqueAvis } from '../../composants-avis/historique-avis'
import { PanneauSuivi } from '../../composants-avis/panneau-suivi'
import { PastilleStatut } from '../../composants-avis/pastille-statut'
import { ReponsesAvis } from '../../composants-avis/reponses-avis'
import { utiliserFicheAvis } from '../../hooks/utiliser-fiche-avis'
import { utiliserLangue } from '../../hooks/utiliser-langue'
import type { FicheAvis } from '../../types/avis'
import { classeFondClairNote, classeTexteNote } from '../../utilitaires/couleurs-notes'
import { formaterDateHeure, formaterNombre } from '../../utilitaires/periodes'
import {
  CLASSES_PASTILLE_ALERTE,
  CLASSES_PASTILLE_PRIORITAIRE,
  niveauDeLaNoteAvis,
} from '../../utilitaires/statuts-avis'

// Ecran E9 : la fiche d'un avis (jour 15), a l'adresse /avis/:id.
// Cet ecran assemble les pieces : resume, alerte, reponses, coordonnees, traitement, historique.
// Les donnees et les actions viennent de utiliserFicheAvis. L'ecran est recree quand l'identifiant
// change (cle sur l'identifiant), comme le hook le demande.
// Les coordonnees du client ne sont affichees que s'il a donne son consentement (l'API renvoie
// contact = null sinon).

const CLASSES_CARTE = 'rounded-xl border border-bordure bg-surface p-4'

// Adresse de la liste a retrouver ("?statut=NOUVEAU&page=2"), donnee par la liste dans l'etat
// de navigation. On n'accepte qu'un texte qui commence par "?" : jamais une adresse complete.
function rechercheDeLaListe(etat: unknown): string {
  if (typeof etat === 'object' && etat !== null && 'listeAdresse' in etat) {
    const valeur = (etat as { listeAdresse: unknown }).listeAdresse
    if (typeof valeur === 'string' && valeur.startsWith('?')) {
      return valeur
    }
  }
  return ''
}

type PropsLigne = {
  etiquette: string
  children: ReactNode
}

// Une ligne "etiquette : valeur" des blocs Details et Coordonnees.
function Ligne({ etiquette, children }: PropsLigne) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2 first:pt-0 last:pb-0">
      <dt className="text-sm text-texte-secondaire">{etiquette}</dt>
      <dd className="min-w-0 break-words text-right text-sm font-medium text-texte">{children}</dd>
    </div>
  )
}

type PropsFiche = {
  fiche: FicheAvis
}

// Note globale (coloree), NPS, statut et alerte, en haut de la fiche.
function Resume({ fiche }: PropsFiche) {
  const { t, langue } = utiliserLangue()
  const niveau = niveauDeLaNoteAvis(fiche.note_globale)

  return (
    <section aria-label={t('avis.fiche.noteGlobale')} className={CLASSES_CARTE}>
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        <div>
          <p className="text-sm text-texte-secondaire">{t('avis.fiche.noteGlobale')}</p>
          {fiche.note_globale === null ? (
            <p className="mt-1 text-sm text-texte-discret">{t('avis.sansNote')}</p>
          ) : (
            <p
              className={`mt-1 inline-block rounded-md px-2 py-0.5 text-2xl font-bold ${classeFondClairNote(niveau)} ${classeTexteNote(niveau)}`}
            >
              {t('avis.noteSur5', { note: formaterNombre(fiche.note_globale, langue) })}
            </p>
          )}
        </div>
        <div>
          <p className="text-sm text-texte-secondaire">{t('avis.fiche.nps')}</p>
          <p className="mt-1 text-2xl font-bold text-texte">
            {fiche.nps === null ? (
              <span className="text-sm font-normal text-texte-discret">{t('avis.nonRenseigne')}</span>
            ) : (
              formaterNombre(fiche.nps, langue)
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PastilleStatut statut={fiche.statut_traitement} />
          {fiche.alerte !== null && (
            <span className={CLASSES_PASTILLE_ALERTE}>{t('avis.alerte')}</span>
          )}
          {fiche.alerte?.niveau === 'PRIORITAIRE' && (
            <span className={CLASSES_PASTILLE_PRIORITAIRE}>{t('avis.prioritaire')}</span>
          )}
        </div>
      </div>
    </section>
  )
}

// Alerte declenchee par cet avis : date, niveau et motifs, tout en texte.
function BlocAlerte({ fiche }: PropsFiche) {
  const { t, langue } = utiliserLangue()
  const alerte = fiche.alerte
  if (alerte === null) {
    return null
  }

  return (
    <section aria-labelledby="titre-alerte-avis" className={CLASSES_CARTE}>
      <h2 id="titre-alerte-avis" className="font-titre text-lg font-bold text-texte">
        {t('avis.fiche.alerte.titre')}
      </h2>
      <p className="mt-1 text-sm text-texte-secondaire">
        {t('avis.fiche.alerte.creeeLe', { date: formaterDateHeure(alerte.cree_le, langue) })}
      </p>
      <dl className="mt-3 divide-y divide-bordure">
        <Ligne etiquette={t('avis.fiche.alerte.niveau')}>
          {t(`avis.fiche.alerte.niveaux.${alerte.niveau}`)}
        </Ligne>
        <Ligne etiquette={t('avis.fiche.alerte.motifs')}>
          {alerte.motifs.length === 0
            ? t('avis.nonRenseigne')
            : alerte.motifs.map((motif) => t(`avis.fiche.alerte.listeMotifs.${motif}`)).join(', ')}
        </Ligne>
      </dl>
    </section>
  )
}

// Date, point de contact, site, questionnaire (avec sa version), langue et appareil.
function BlocDetails({ fiche }: PropsFiche) {
  const { t, langue } = utiliserLangue()

  const titreQuestionnaire =
    langue === 'en' && fiche.version.questionnaire.titre.en
      ? fiche.version.questionnaire.titre.en
      : fiche.version.questionnaire.titre.fr

  const langueClient =
    fiche.langue === 'fr'
      ? t('commun.francais')
      : fiche.langue === 'en'
        ? t('commun.anglais')
        : fiche.langue

  // L'appareil est deduit par le serveur : mobile, tablette ou ordinateur (ou rien).
  const appareil =
    fiche.appareil === 'mobile' || fiche.appareil === 'tablette' || fiche.appareil === 'ordinateur'
      ? t(`avis.appareils.${fiche.appareil}`)
      : t('avis.nonRenseigne')

  return (
    <section aria-labelledby="titre-details-avis" className={CLASSES_CARTE}>
      <h2 id="titre-details-avis" className="font-titre text-lg font-bold text-texte">
        {t('avis.fiche.details.titre')}
      </h2>
      <dl className="mt-3 divide-y divide-bordure">
        <Ligne etiquette={t('avis.fiche.details.recuLe')}>
          <time dateTime={fiche.soumis_le}>{formaterDateHeure(fiche.soumis_le, langue)}</time>
        </Ligne>
        <Ligne etiquette={t('avis.fiche.details.pointContact')}>{fiche.point_contact.nom}</Ligne>
        <Ligne etiquette={t('avis.fiche.details.site')}>{fiche.site.nom}</Ligne>
        <Ligne etiquette={t('avis.fiche.details.questionnaire')}>
          {titreQuestionnaire} ({t('avis.fiche.details.version', { numero: fiche.version.numero })})
        </Ligne>
        <Ligne etiquette={t('avis.fiche.details.langue')}>{langueClient}</Ligne>
        <Ligne etiquette={t('avis.fiche.details.appareil')}>{appareil}</Ligne>
      </dl>
    </section>
  )
}

// Coordonnees du client, seulement s'il a consenti. Sinon : un message qui l'explique.
function BlocCoordonnees({ fiche }: PropsFiche) {
  const { t } = utiliserLangue()
  const contact = fiche.contact

  return (
    <section aria-labelledby="titre-coordonnees-avis" className={CLASSES_CARTE}>
      <h2 id="titre-coordonnees-avis" className="font-titre text-lg font-bold text-texte">
        {t('avis.fiche.coordonnees.titre')}
      </h2>
      {contact === null ? (
        <p className="mt-2 text-sm text-texte-discret">{t('avis.fiche.coordonnees.sansConsentement')}</p>
      ) : (
        <dl className="mt-3 divide-y divide-bordure">
          <Ligne etiquette={t('avis.fiche.coordonnees.nom')}>
            {contact.nom ?? t('avis.nonRenseigne')}
          </Ligne>
          <Ligne etiquette={t('avis.fiche.coordonnees.telephone')}>
            {contact.telephone === null ? (
              t('avis.nonRenseigne')
            ) : (
              <a href={`tel:${contact.telephone}`} className="underline">
                {contact.telephone}
              </a>
            )}
          </Ligne>
          <Ligne etiquette={t('avis.fiche.coordonnees.email')}>
            {contact.email === null ? (
              t('avis.nonRenseigne')
            ) : (
              <a href={`mailto:${contact.email}`} className="underline">
                {contact.email}
              </a>
            )}
          </Ligne>
        </dl>
      )}
    </section>
  )
}

type PropsContenu = {
  id: string
}

function ContenuFicheAvis({ id }: PropsContenu) {
  const { t, langue } = utiliserLangue()
  const { state } = useLocation()
  const {
    fiche,
    chargementInitial,
    chargementEnCours,
    erreur,
    introuvable,
    recharger,
    changerStatut,
    statutEnCours,
    erreurStatut,
    ajouterNote,
    noteEnCours,
    erreurNote,
  } = utiliserFicheAvis(id)

  const adresseListe = `/avis${rechercheDeLaListe(state)}`

  const lienRetour = (
    <Link
      to={adresseListe}
      className="inline-flex min-h-11 items-center text-sm font-medium text-texte-secondaire underline hover:text-texte"
    >
      ← {t('avis.fiche.retour')}
    </Link>
  )

  if (chargementInitial) {
    return (
      <div className="space-y-4">
        {lienRetour}
        <p role="status" className="text-texte-secondaire">
          {t('avis.fiche.chargement')}
        </p>
      </div>
    )
  }

  if (fiche === null) {
    return (
      <div className="space-y-4">
        {lienRetour}
        <div role="alert" className="space-y-3 rounded-lg bg-surface/50 p-5">
          <p className="text-erreur">
            {introuvable
              ? t('avis.fiche.introuvable')
              : erreur !== null && erreur.statut === 0
                ? t('commun.erreurReseau')
                : t('avis.fiche.erreur')}
          </p>
          {!introuvable && (
            <button
              type="button"
              onClick={recharger}
              disabled={chargementEnCours}
              className="min-h-11 rounded-md bg-principale px-4 text-sm font-medium text-texte-sur-principale transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('commun.reessayer')}
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {lienRetour}
      <h1 className="font-titre text-2xl font-bold text-texte">
        {t('avis.fiche.titre', { date: formaterDateHeure(fiche.soumis_le, langue) })}
      </h1>

      <Resume fiche={fiche} />
      <BlocAlerte fiche={fiche} />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <ReponsesAvis fiche={fiche} />
        </div>
        <div className="space-y-4">
          <PanneauSuivi
            statutActuel={fiche.statut_traitement}
            changerStatut={changerStatut}
            statutEnCours={statutEnCours}
            erreurStatut={erreurStatut}
            ajouterNote={ajouterNote}
            noteEnCours={noteEnCours}
            erreurNote={erreurNote}
          />
          <HistoriqueAvis suivis={fiche.suivis} />
          <BlocDetails fiche={fiche} />
          <BlocCoordonnees fiche={fiche} />
        </div>
      </div>
    </div>
  )
}

export function PageFicheAvis() {
  const { id } = useParams()

  if (id === undefined || id === '') {
    return <Navigate to="/avis" replace />
  }

  // La cle recree l'ecran (et le hook) quand on passe d'un avis a un autre.
  return <ContenuFicheAvis key={id} id={id} />
}