import { useId } from 'react'
import { Link } from 'react-router'
import { utiliserLangue } from '../hooks/utiliser-langue'
import { construireLienAvis } from '../services/tableau-de-bord'
import type { AvisRecent, FiltresApi, StatutTraitement } from '../types/tableau-de-bord'
import { classeFondClairNote, classeTexteNote, niveauDeNoteEntiere } from '../utilitaires/couleurs-notes'
import { formaterDateHeure, formaterNombre } from '../utilitaires/periodes'

type Proprietes = {
  avis: AvisRecent[]
  // Filtres qui ont produit les donnees affichees (pour le lien "Voir tous les avis")
  filtres: FiltresApi | null
}

// Nombre maximum d'avis affiches
const NOMBRE_MAX = 10

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

  return (
    <section
      aria-labelledby={idTitre}
      className="rounded-lg border border-bordure bg-surface p-4 shadow-doux"
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
        <ul className="mt-3 space-y-2">
          {avis.slice(0, NOMBRE_MAX).map((unAvis) => {
            const note = unAvis.note_globale
            const niveau = note === null ? null : niveauDeNoteEntiere(Math.round(note))
            const dateTexte = formaterDateHeure(unAvis.soumis_le, langue)

            return (
              <li key={unAvis.id}>
                <Link
                  to={`/avis/${unAvis.id}`}
                  aria-label={t('tableau.avisRecents.ouvrir', { date: dateTexte })}
                  className="block rounded-md border border-bordure bg-fond p-3 transition-colors hover:bg-fond-alt"
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
                    <p className="mt-2 line-clamp-2 break-words text-sm text-texte">
                      {unAvis.commentaire_extrait}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm italic text-texte-discret">
                      {t('tableau.avisRecents.sansCommentaire')}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-texte-secondaire">
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
      )}
    </section>
  )
}