import { useId } from 'react'
import { Link } from 'react-router'
import { utiliserLangue } from '../hooks/utiliser-langue'
import { utiliserPages } from '../hooks/utiliser-pages'
import { construireLienAvis } from '../services/tableau-de-bord'
import type { AvisRecent, FiltresApi, StatutTraitement } from '../types/tableau-de-bord'
import { classeFondClairNote, classeTexteNote, niveauDeNoteEntiere } from '../utilitaires/couleurs-notes'
import { formaterDateHeure, formaterNombre } from '../utilitaires/periodes'
import { Pagination } from './pagination'

type Proprietes = {
  avis: AvisRecent[]
  // Filtres qui ont produit les donnees affichees (pour le lien "Voir tous les avis")
  filtres: FiltresApi | null
}

// Nombre maximum d'avis affiches
const NOMBRE_MAX = 10

// Refonte de l'accueil : les avis sont coupes en pages (fleches, points, "Page 1 sur 3") et le nombre
// d'avis par page se calcule d'apres la hauteur du panneau, pour que rien ne defile.
// Hauteur en pixels d'un avis, estimee d'apres les classes : p-2.5 (20) + pastilles (22) + commentaire
// sur une ligne (26) + lieu (18) = 86, plus 8 d'espace avant l'avis suivant.
// A ajuster si le dernier avis est coupe ou s'il reste trop de vide en bas.
const HAUTEUR_AVIS = 94

const BASE_PASTILLE =
  'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium'

// Couleur de la pastille selon le statut de traitement
const CLASSES_STATUT: Record<StatutTraitement, string> = {
  NOUVEAU: 'border-principale bg-principale text-texte-sur-principale',
  EN_COURS: 'border-bordure-champ bg-surface text-texte',
  TRAITE: 'border-succes bg-surface text-succes',
  IGNORE: 'border-bordure bg-surface text-texte-discret',
}

export function AvisRecents({ avis, filtres }: Proprietes) {
  const { t, langue } = utiliserLangue()
  const idTitre = useId()

  const avisAffiches = avis.slice(0, NOMBRE_MAX)
  const { refZone, elementsPage, pageCourante, nbPages, allerA } = utiliserPages(avisAffiches, {
    hauteurLigne: HAUTEUR_AVIS,
  })

  return (
    <section
      aria-labelledby={idTitre}
      className="accueil-remplir rounded-lg bg-surface/50 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={idTitre} className="font-titre text-lg font-bold text-texte">
          {t('tableau.avisRecents.titre')}
        </h2>
        <Link
          to={construireLienAvis(filtres ?? {})}
          className="inline-flex min-h-11 items-center rounded-md border border-bordure-champ px-3 text-sm font-medium text-texte hover:bg-fond-alt"
        >
          {t('tableau.avisRecents.voirTous')}
        </Link>
      </div>

      {avis.length === 0 ? (
        <p className="mt-3 text-sm text-texte-secondaire">{t('tableau.avisRecents.aucun')}</p>
      ) : (
        <div ref={refZone} className="accueil-liste-zone">
          <ul className="space-y-2">
            {elementsPage.map((unAvis) => {
              const note = unAvis.note_globale
              const niveau = note === null ? null : niveauDeNoteEntiere(Math.round(note))
              const dateTexte = formaterDateHeure(unAvis.soumis_le, langue)

              return (
                <li key={unAvis.id}>
                  <Link
                    to={`/avis/${unAvis.id}`}
                    aria-label={t('tableau.avisRecents.ouvrir', { date: dateTexte })}
                    className="block rounded-md bg-fond-alt/50 p-2.5 transition-colors hover:bg-fond-alt"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-texte-secondaire">{dateTexte}</span>
                      {note === null ? (
                        <span className="text-xs text-texte-discret">
                          {t('tableau.avisRecents.sansNote')}
                        </span>
                      ) : (
                        <span
                          className={`${BASE_PASTILLE} border-transparent ${classeFondClairNote(niveau)} ${classeTexteNote(niveau)}`}
                        >
                          {t('tableau.avisRecents.noteSur5', { note: formaterNombre(note, langue) })}
                        </span>
                      )}
                      {unAvis.nps !== null ? (
                        <span className="text-xs font-medium text-texte-secondaire">
                          {t('tableau.avisRecents.npsValeur', { valeur: unAvis.nps })}
                        </span>
                      ) : null}
                      <span className={`${BASE_PASTILLE} ${CLASSES_STATUT[unAvis.statut_traitement]}`}>
                        {t(`tableau.avisRecents.statuts.${unAvis.statut_traitement}`)}
                      </span>
                      {unAvis.en_alerte ? (
                        <span className={`${BASE_PASTILLE} border-erreur bg-surface text-erreur`}>
                          {t('tableau.avisRecents.alerte')}
                        </span>
                      ) : null}
                      {unAvis.niveau_alerte === 'PRIORITAIRE' ? (
                        <span className={`${BASE_PASTILLE} border-erreur bg-erreur text-surface`}>
                          {t('tableau.avisRecents.prioritaire')}
                        </span>
                      ) : null}
                    </div>
                    {unAvis.commentaire_extrait !== null ? (
                      <p className="mt-1.5 line-clamp-1 break-words text-sm text-texte">
                        {unAvis.commentaire_extrait}
                      </p>
                    ) : (
                      <p className="mt-1.5 text-sm italic text-texte-discret">
                        {t('tableau.avisRecents.sansCommentaire')}
                      </p>
                    )}
                    <p className="mt-0.5 text-xs text-texte-secondaire">
                      {t('tableau.avisRecents.lieu', {
                        point: unAvis.point_contact.nom,
                        site: unAvis.site.nom,
                      })}
                    </p>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <Pagination pageCourante={pageCourante} nbPages={nbPages} onAller={allerA} />
    </section>
  )
}