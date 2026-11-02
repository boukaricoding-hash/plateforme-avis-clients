import type { ReactNode } from 'react'
import { IconeNoteMoyenne } from '../composants-tableau/icones-accueil'
import { utiliserFicheAvis } from '../hooks/utiliser-fiche-avis'
import { utiliserLangue } from '../hooks/utiliser-langue'
import type { FicheAvis } from '../types/avis'
import type { StatutTraitement } from '../types/tableau-de-bord'
import { classeTexteNote } from '../utilitaires/couleurs-notes'
import { formaterDateHeure, formaterNombre } from '../utilitaires/periodes'
import {
  CLASSES_PASTILLE_ALERTE,
  CLASSES_PASTILLE_PRIORITAIRE,
  niveauDeLaNoteAvis,
} from '../utilitaires/statuts-avis'
import { HistoriqueAvis } from './historique-avis'
import { IconeDocument, IconeScore, IconeTable, IconeUtilisateur } from './icones-avis'
import { PanneauSuivi } from './panneau-suivi'
import { PastilleStatut } from './pastille-statut'
import { ReponsesAvis } from './reponses-avis'

// Panneau de droite de la page des avis (jour 15 design) : le detail de l'avis choisi dans la liste.
// Il remplace la page de fiche (E9). Il charge lui-meme la fiche (hook utiliserFicheAvis) et
// assemble les pieces : titre et statut, resume (note, NPS, table), puis deux colonnes.
// - Colonne de gauche : commentaire, reponses, details, coordonnees du client.
// - Colonne de droite : traitement de l'avis (statut et note), historique.
// Les coordonnees du client ne sont affichees que s'il a donne son consentement (l'API renvoie
// contact = null sinon).
// Le style vient de styles/avis.css (classes avis-detail, avis-resume, avis-detail-grille...).
//
// Le hook de la fiche suppose que son composant est recree quand l'identifiant change :
// c'est ce que fait la cle sur l'identifiant, ici, dans DetailAvis.

type Proprietes = {
  // Identifiant de l'avis choisi, ou null quand aucun avis n'est choisi
  id: string | null
  // Appele apres un changement de statut reussi : la page recharge la liste, pour que la carte
  // de l'avis affiche le nouveau statut.
  onStatutChange: () => void
}

type PropsFiche = {
  fiche: FicheAvis
}

type PropsLigne = {
  etiquette: string
  children: ReactNode
}

// Une ligne "etiquette : valeur" des blocs Details et Coordonnees.
function LigneDonnee({ etiquette, children }: PropsLigne) {
  return (
    <div className="avis-ligne-donnee">
      <dt>{etiquette}</dt>
      <dd>{children}</dd>
    </div>
  )
}

// Titre de l'avis, statut et alerte (en toutes lettres : la couleur ne suffit jamais seule).
function EnteteDetail({ fiche }: PropsFiche) {
  const { t, langue } = utiliserLangue()

  return (
    <div className="avis-detail-tete">
      <h2 id="titre-detail-avis" className="avis-detail-titre">
        {t('avis.fiche.titre', { date: formaterDateHeure(fiche.soumis_le, langue) })}
      </h2>
      <div className="flex flex-wrap items-center gap-2">
        <PastilleStatut statut={fiche.statut_traitement} />
        {fiche.alerte !== null && <span className={CLASSES_PASTILLE_ALERTE}>{t('avis.alerte')}</span>}
        {fiche.alerte?.niveau === 'PRIORITAIRE' && (
          <span className={CLASSES_PASTILLE_PRIORITAIRE}>{t('avis.prioritaire')}</span>
        )}
      </div>
    </div>
  )
}

// Note globale (coloree), NPS et point de contact, en trois cases.
function ResumeAvis({ fiche }: PropsFiche) {
  const { t, langue } = utiliserLangue()
  const niveau = niveauDeLaNoteAvis(fiche.note_globale)

  return (
    <div className="avis-resume">
      <div className="avis-resume-item">
        <IconeNoteMoyenne width={24} height={24} />
        <div className="min-w-0">
          <p className="avis-resume-valeur">
            {fiche.note_globale === null ? (
              <span className="text-sm font-normal text-texte-discret">{t('avis.sansNote')}</span>
            ) : (
              <span className={classeTexteNote(niveau)}>
                {t('avis.noteSur5', { note: formaterNombre(fiche.note_globale, langue) })}
              </span>
            )}
          </p>
          <p className="avis-resume-etiquette">{t('avis.fiche.noteGlobale')}</p>
        </div>
      </div>

      <div className="avis-resume-item">
        <IconeScore width={24} height={24} />
        <div className="min-w-0">
          <p className="avis-resume-valeur">
            {fiche.nps === null ? (
              <span className="text-sm font-normal text-texte-discret">{t('avis.nonRenseigne')}</span>
            ) : (
              formaterNombre(fiche.nps, langue)
            )}
          </p>
          <p className="avis-resume-etiquette">{t('avis.fiche.nps')}</p>
        </div>
      </div>

      <div className="avis-resume-item">
        <IconeTable width={24} height={24} />
        <div className="min-w-0">
          <p className="avis-resume-valeur truncate" title={fiche.point_contact.nom}>
            {fiche.point_contact.nom}
          </p>
          <p className="avis-resume-etiquette">{t('avis.fiche.details.pointContact')}</p>
        </div>
      </div>
    </div>
  )
}

// Site, questionnaire (avec sa version), langue, appareil, et l'alerte si l'avis en a declenche une.
// La date et le point de contact sont deja dans le titre et le resume.
function BlocDetails({ fiche }: PropsFiche) {
  const { t, langue } = utiliserLangue()

  const titreQuestionnaire =
    langue === 'en' && fiche.version.questionnaire.titre.en
      ? fiche.version.questionnaire.titre.en
      : fiche.version.questionnaire.titre.fr
  const questionnaire = `${titreQuestionnaire} (${t('avis.fiche.details.version', { numero: fiche.version.numero })})`

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

  const alerte = fiche.alerte

  return (
    <section aria-labelledby="titre-details-avis" className="avis-panneau">
      <h3 id="titre-details-avis" className="avis-panneau-titre">
        <IconeDocument />
        {t('avis.fiche.details.titre')}
      </h3>
      <dl className="m-0">
        <LigneDonnee etiquette={t('avis.fiche.details.site')}>{fiche.site.nom}</LigneDonnee>
        <LigneDonnee etiquette={t('avis.fiche.details.questionnaire')}>
          <span className="block truncate" title={questionnaire}>
            {questionnaire}
          </span>
        </LigneDonnee>
        <LigneDonnee etiquette={t('avis.fiche.details.langue')}>{langueClient}</LigneDonnee>
        <LigneDonnee etiquette={t('avis.fiche.details.appareil')}>{appareil}</LigneDonnee>
        {alerte !== null && (
          <LigneDonnee etiquette={t('avis.fiche.alerte.titre')}>
            {t(`avis.fiche.alerte.niveaux.${alerte.niveau}`)}
            {' · '}
            {alerte.motifs.length === 0
              ? t('avis.nonRenseigne')
              : alerte.motifs.map((motif) => t(`avis.fiche.alerte.listeMotifs.${motif}`)).join(', ')}
          </LigneDonnee>
        )}
      </dl>
    </section>
  )
}

// Coordonnees du client, seulement s'il a consenti. Sinon : un message qui l'explique.
function BlocCoordonnees({ fiche }: PropsFiche) {
  const { t } = utiliserLangue()
  const contact = fiche.contact

  return (
    <section aria-labelledby="titre-coordonnees-avis" className="avis-panneau">
      <h3 id="titre-coordonnees-avis" className="avis-panneau-titre">
        <IconeUtilisateur />
        {t('avis.fiche.coordonnees.titre')}
      </h3>
      {contact === null ? (
        <p className="m-0 text-sm text-texte-discret">{t('avis.fiche.coordonnees.sansConsentement')}</p>
      ) : (
        <dl className="m-0">
          <LigneDonnee etiquette={t('avis.fiche.coordonnees.nom')}>
            {contact.nom ?? t('avis.nonRenseigne')}
          </LigneDonnee>
          <LigneDonnee etiquette={t('avis.fiche.coordonnees.telephone')}>
            {contact.telephone === null ? (
              t('avis.nonRenseigne')
            ) : (
              <a href={`tel:${contact.telephone}`} className="underline">
                {contact.telephone}
              </a>
            )}
          </LigneDonnee>
          <LigneDonnee etiquette={t('avis.fiche.coordonnees.email')}>
            {contact.email === null ? (
              t('avis.nonRenseigne')
            ) : (
              <a href={`mailto:${contact.email}`} className="break-all underline">
                {contact.email}
              </a>
            )}
          </LigneDonnee>
        </dl>
      )}
    </section>
  )
}

type PropsContenu = {
  id: string
  onStatutChange: () => void
}

function ContenuDetailAvis({ id, onStatutChange }: PropsContenu) {
  const { t } = utiliserLangue()
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

  // Apres un changement de statut reussi, on previent la page pour qu'elle recharge la liste.
  async function changerStatutEtPrevenir(
    statut: StatutTraitement,
    commentaire: string,
  ): Promise<boolean> {
    const reussi = await changerStatut(statut, commentaire)
    if (reussi) {
      onStatutChange()
    }
    return reussi
  }

  if (chargementInitial) {
    return (
      <section className="avis-detail">
        <p role="status" className="avis-vide">
          {t('avis.fiche.chargement')}
        </p>
      </section>
    )
  }

  if (fiche === null) {
    return (
      <section className="avis-detail">
        <div role="alert" className="avis-vide space-y-3">
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
              className="avis-bouton-principal"
            >
              {t('commun.reessayer')}
            </button>
          )}
        </div>
      </section>
    )
  }

  return (
    <section aria-labelledby="titre-detail-avis" className="avis-detail">
      <EnteteDetail fiche={fiche} />
      <ResumeAvis fiche={fiche} />

      <div className="avis-detail-grille">
        <div className="avis-detail-col">
          <ReponsesAvis fiche={fiche} />
          <BlocDetails fiche={fiche} />
          <BlocCoordonnees fiche={fiche} />
        </div>
        <div className="avis-detail-col">
          <PanneauSuivi
            statutActuel={fiche.statut_traitement}
            changerStatut={changerStatutEtPrevenir}
            statutEnCours={statutEnCours}
            erreurStatut={erreurStatut}
            ajouterNote={ajouterNote}
            noteEnCours={noteEnCours}
            erreurNote={erreurNote}
          />
          <HistoriqueAvis suivis={fiche.suivis} />
        </div>
      </div>
    </section>
  )
}

export function DetailAvis({ id, onStatutChange }: Proprietes) {
  const { t } = utiliserLangue()

  if (id === null) {
    return (
      <section className="avis-detail">
        <p className="avis-vide">{t('avis.detail.choisir')}</p>
      </section>
    )
  }

  // La cle recree le panneau (et le hook) quand on passe d'un avis a un autre.
  return <ContenuDetailAvis key={id} id={id} onStatutChange={onStatutChange} />
}