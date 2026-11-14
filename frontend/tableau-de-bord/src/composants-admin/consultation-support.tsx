import type { ReactNode } from 'react'
import { Pagination } from '../composants-tableau/pagination'
import { utiliserLangue } from '../hooks/utiliser-langue'
import type { ResultatSupport } from '../hooks/utiliser-support'
import { classeTexteNote } from '../utilitaires/couleurs-notes'
import { formaterDateHeure, formaterJour, formaterNombre } from '../utilitaires/periodes'
import { classePastilleStatut, cleTexteStatut, niveauDeLaNoteAvis } from '../utilitaires/statuts-avis'
import { PastilleStatutOrganisation } from './pastille-statut-organisation'

// Consultation de support en lecture seule (jour 24), administrateur DTS seulement.
// Elle montre ce que l'organisation a accepte de laisser voir : la fiche, les indicateurs,
// les avis (par page), les sites, les points de contact et les utilisateurs.
// Ce composant ne charge rien et ne modifie rien : il n'y a ni bouton d'action ni formulaire.
// La page lui donne le resultat du hook utiliserSupport et ne l'affiche que lorsque
// le statut vaut 'pret' (les autres cas : chargement, sans accord, introuvable, erreur).
// Les coordonnees des clients sont masquees par le serveur : on ne les affiche jamais,
// et un bandeau le rappelle.
// Une valeur null venant de l'API veut dire "pas de donnee" : elle s'affiche avec un tiret, jamais comme 0.
// Le code public des points de contact n'est jamais affiche.
// Textes : suiviDts.support.consultation.* ; roles.* et avis.statuts.* existent deja.

type Proprietes = {
  support: ResultatSupport
}

type PropsSection = {
  titre: string
  children: ReactNode
}

type PropsChamp = {
  etiquette: string
  valeur: ReactNode
}

const CLASSE_CARTE = 'flex flex-col gap-3 rounded-lg border border-bordure bg-surface p-5 shadow-doux'
const CLASSE_LIGNE = 'flex flex-col gap-1 rounded-md border border-bordure p-3'
const CLASSE_MESSAGE = 'm-0 text-sm text-texte-secondaire'

// Une section avec son titre, reliee a lui pour les lecteurs d'ecran.
function Section({ titre, children }: PropsSection) {
  return (
    <section className={CLASSE_CARTE} aria-label={titre}>
      <h2 className="m-0 font-titre text-lg font-bold text-texte">{titre}</h2>
      {children}
    </section>
  )
}

// Un petit couple "etiquette / valeur".
function Champ({ etiquette, valeur }: PropsChamp) {
  return (
    <div className="flex min-w-0 flex-col">
      <dt className="text-xs text-texte-discret">{etiquette}</dt>
      <dd className="m-0 break-words text-sm text-texte">{valeur}</dd>
    </div>
  )
}

export function ConsultationSupport({ support }: Proprietes) {
  const { t, langue } = utiliserLangue()
  const {
    organisation,
    indicateurs,
    sites,
    pointsContact,
    utilisateurs,
    chargementParties,
    erreursParties,
    avis,
    chargementAvis,
    changerPageAvis,
  } = support

  const aucuneDonnee = t('suiviDts.support.consultation.aucuneDonnee')

  // Un nombre, ou un tiret quand le serveur n'a pas de donnee (null).
  function nombreOuTiret(valeur: number | null, unite = ''): string {
    return valeur === null ? aucuneDonnee : `${formaterNombre(valeur, langue)}${unite}`
  }

  // Message d'une partie : chargement, erreur ou liste vide. null = il y a des lignes a montrer.
  function messagePartie(partie: keyof typeof erreursParties, nbLignes: number, texteVide: string): ReactNode {
    if (erreursParties[partie] !== null) {
      return <p className={CLASSE_MESSAGE}>{t('suiviDts.support.consultation.erreurPartie')}</p>
    }
    if (chargementParties) {
      return <p className={CLASSE_MESSAGE}>{t('suiviDts.support.consultation.chargement')}</p>
    }
    if (nbLignes === 0) {
      return <p className={CLASSE_MESSAGE}>{texteVide}</p>
    }
    return null
  }

  const messageIndicateurs = messagePartie('indicateurs', indicateurs === null ? 0 : 1, aucuneDonnee)
  const messageSites = messagePartie('sites', sites.length, t('suiviDts.support.consultation.sites.aucun'))
  const messagePoints = messagePartie(
    'pointsContact',
    pointsContact.length,
    t('suiviDts.support.consultation.points.aucun'),
  )
  const messageUtilisateurs = messagePartie(
    'utilisateurs',
    utilisateurs.length,
    t('suiviDts.support.consultation.utilisateurs.aucun'),
  )

  return (
    <div className="flex flex-col gap-4">
      <p role="note" className="m-0 rounded-lg border border-info bg-surface p-4 text-sm text-texte">
        {t('suiviDts.support.consultation.lectureSeule')}
      </p>

      {organisation !== null && (
        <Section titre={t('suiviDts.support.consultation.fiche.titre')}>
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="m-0 break-words text-xl font-semibold text-texte">{organisation.nom}</h3>
            <PastilleStatutOrganisation statut={organisation.statut} />
          </div>
          <dl className="m-0 grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            <Champ
              etiquette={t('suiviDts.support.consultation.fiche.secteur')}
              valeur={langue === 'en' ? organisation.secteur.nom_en : organisation.secteur.nom_fr}
            />
            <Champ etiquette={t('suiviDts.support.consultation.fiche.pays')} valeur={organisation.pays} />
            <Champ
              etiquette={t('suiviDts.support.consultation.fiche.fuseau')}
              valeur={organisation.fuseau_horaire}
            />
            <Champ
              etiquette={t('suiviDts.support.consultation.fiche.langue')}
              valeur={organisation.langue_defaut.toUpperCase()}
            />
            <Champ
              etiquette={t('suiviDts.support.consultation.fiche.creeLe')}
              valeur={formaterDateHeure(organisation.cree_le, langue)}
            />
          </dl>
        </Section>
      )}

      <Section titre={t('suiviDts.support.consultation.indicateurs.titre')}>
        {indicateurs !== null ? (
          <>
            <p className={CLASSE_MESSAGE}>
              {t('suiviDts.support.consultation.indicateurs.periode', {
                debut: formaterJour(indicateurs.periode.from, langue),
                fin: formaterJour(indicateurs.periode.to, langue),
              })}
            </p>
            <dl className="m-0 grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              <Champ
                etiquette={t('suiviDts.support.consultation.indicateurs.nbAvis')}
                valeur={formaterNombre(indicateurs.indicateurs.nb_avis, langue, { decimales: 0 })}
              />
              <Champ
                etiquette={t('suiviDts.support.consultation.indicateurs.noteMoyenne')}
                valeur={nombreOuTiret(indicateurs.indicateurs.note_moyenne, ' / 5')}
              />
              <Champ
                etiquette={t('suiviDts.support.consultation.indicateurs.csat')}
                valeur={nombreOuTiret(indicateurs.indicateurs.csat, ' %')}
              />
              <Champ
                etiquette={t('suiviDts.support.consultation.indicateurs.nps')}
                valeur={nombreOuTiret(indicateurs.indicateurs.nps)}
              />
              <Champ
                etiquette={t('suiviDts.support.consultation.indicateurs.tauxReponse')}
                valeur={nombreOuTiret(indicateurs.indicateurs.taux_reponse, ' %')}
              />
              <Champ
                etiquette={t('suiviDts.support.consultation.indicateurs.alertes')}
                valeur={formaterNombre(indicateurs.alertes_ouvertes.nombre, langue, { decimales: 0 })}
              />
            </dl>
          </>
        ) : (
          messageIndicateurs
        )}
      </Section>

      <Section titre={t('suiviDts.support.consultation.avis.titre')}>
        {erreursParties.avis !== null ? (
          <p className={CLASSE_MESSAGE}>{t('suiviDts.support.consultation.erreurPartie')}</p>
        ) : avis === null ? (
          <p className={CLASSE_MESSAGE}>
            {chargementAvis ? t('suiviDts.support.consultation.chargement') : aucuneDonnee}
          </p>
        ) : (
          <>
            <p aria-live="polite" className={CLASSE_MESSAGE}>
              {t('suiviDts.support.consultation.avis.resultats', { total: avis.pagination.total })}
            </p>
            {avis.avis.length === 0 ? (
              <p className={CLASSE_MESSAGE}>{t('suiviDts.support.consultation.avis.aucun')}</p>
            ) : (
              <ul
                aria-busy={chargementAvis}
                className={`m-0 flex list-none flex-col gap-3 p-0 transition-opacity ${chargementAvis ? 'opacity-60' : ''}`}
              >
                {avis.avis.map((ligne) => (
                  <li key={ligne.id} className={CLASSE_LIGNE}>
                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                      <time dateTime={ligne.soumis_le} className="text-sm text-texte-secondaire">
                        {formaterDateHeure(ligne.soumis_le, langue)}
                      </time>
                      <div className="flex flex-wrap items-center gap-2">
                        {ligne.en_alerte && (
                          <span className="inline-flex items-center rounded-full border border-erreur bg-surface px-2 py-0.5 text-xs font-medium text-erreur">
                            {t('suiviDts.support.consultation.avis.alerte')}
                          </span>
                        )}
                        <span className={classePastilleStatut(ligne.statut_traitement)}>
                          {t(cleTexteStatut(ligne.statut_traitement))}
                        </span>
                      </div>
                    </div>
                    <p className="m-0 text-sm text-texte">
                      <span
                        className={`font-semibold ${classeTexteNote(niveauDeLaNoteAvis(ligne.note_globale))}`}
                      >
                        {ligne.note_globale === null
                          ? t('suiviDts.support.consultation.avis.sansNote')
                          : `${formaterNombre(ligne.note_globale, langue)} / 5`}
                      </span>
                      {' · '}
                      {ligne.site.nom}
                      {' · '}
                      {ligne.point_contact.nom}
                    </p>
                    <p className="m-0 break-words text-sm text-texte-secondaire">
                      {ligne.commentaire_extrait ?? t('suiviDts.support.consultation.avis.sansCommentaire')}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <Pagination
              pageCourante={avis.pagination.page - 1}
              nbPages={avis.pagination.pages}
              onAller={(page) => changerPageAvis(page + 1)}
            />
          </>
        )}
      </Section>

      <Section titre={t('suiviDts.support.consultation.sites.titre')}>
        {messageSites ?? (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {sites.map((site) => (
              <li key={site.id} className={CLASSE_LIGNE}>
                <p className="m-0 flex flex-wrap items-center gap-2 text-sm font-semibold text-texte">
                  {site.nom}
                  {!site.actif && (
                    <span className="text-xs font-normal text-texte-discret">
                      {t('suiviDts.support.consultation.inactif')}
                    </span>
                  )}
                </p>
                {(site.ville !== null || site.adresse !== null) && (
                  <p className="m-0 break-words text-xs text-texte-secondaire">
                    {[site.adresse, site.ville].filter((valeur) => valeur !== null).join(', ')}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section titre={t('suiviDts.support.consultation.points.titre')}>
        {messagePoints ?? (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {pointsContact.map((point) => (
              <li key={point.id} className={CLASSE_LIGNE}>
                <p className="m-0 flex flex-wrap items-center gap-2 text-sm font-semibold text-texte">
                  {point.nom}
                  {!point.actif && (
                    <span className="text-xs font-normal text-texte-discret">
                      {t('suiviDts.support.consultation.inactif')}
                    </span>
                  )}
                </p>
                <p className="m-0 break-words text-xs text-texte-secondaire">
                  {[point.type, point.zone].filter((valeur) => valeur !== null).join(' · ')}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section titre={t('suiviDts.support.consultation.utilisateurs.titre')}>
        {messageUtilisateurs ?? (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {utilisateurs.map((utilisateur) => (
              <li key={utilisateur.id} className={CLASSE_LIGNE}>
                <p className="m-0 flex flex-wrap items-center gap-2 text-sm font-semibold text-texte">
                  {utilisateur.nom}
                  <span className="text-xs font-normal text-texte-secondaire">
                    {t(`roles.${utilisateur.role}`)}
                  </span>
                  {!utilisateur.actif && (
                    <span className="text-xs font-normal text-texte-discret">
                      {t('suiviDts.support.consultation.inactif')}
                    </span>
                  )}
                </p>
                <p className="m-0 break-words text-xs text-texte-secondaire">{utilisateur.email}</p>
                <p className="m-0 text-xs text-texte-discret">
                  {utilisateur.derniere_connexion === null
                    ? t('suiviDts.support.consultation.utilisateurs.jamaisConnecte')
                    : t('suiviDts.support.consultation.utilisateurs.derniereConnexion', {
                        date: formaterDateHeure(utilisateur.derniere_connexion, langue),
                      })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}