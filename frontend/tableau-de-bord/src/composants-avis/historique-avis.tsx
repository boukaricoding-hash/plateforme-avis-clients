import { utiliserLangue } from '../hooks/utiliser-langue'
import type { LigneSuivi } from '../types/avis'
import { formaterDateHeure } from '../utilitaires/periodes'
import { cleTexteStatut } from '../utilitaires/statuts-avis'

// Bloc "Historique" de la fiche d'un avis (E9) : qui a fait quoi, et quand.
// Une ligne par changement de statut ou par note interne, du plus recent au plus ancien
// (l'ordre vient de l'API et du hook, ce composant ne trie pas).
// Ce composant n'appelle pas l'API : il affiche les lignes deja chargees.
// Le type de chaque ligne est ecrit en toutes lettres : pas seulement une couleur ou une icone.

type Proprietes = {
  suivis: LigneSuivi[]
}

type ProprietesLigne = {
  suivi: LigneSuivi
}

function LigneHistorique({ suivi }: ProprietesLigne) {
  const { t, langue } = utiliserLangue()

  const estChangement = suivi.type === 'CHANGEMENT_STATUT'
  const commentaire = suivi.commentaire?.trim() ?? ''

  // "Nouveau → En cours". Si un des deux statuts manque, on n'affiche pas la ligne de statuts.
  const changement =
    estChangement && suivi.ancien_statut !== null && suivi.nouveau_statut !== null
      ? t('avis.fiche.historique.statutVers', {
          ancien: t(cleTexteStatut(suivi.ancien_statut)),
          nouveau: t(cleTexteStatut(suivi.nouveau_statut)),
        })
      : null

  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <p className="text-sm font-medium text-texte">
          {estChangement ? t('avis.fiche.historique.changementStatut') : t('avis.fiche.historique.noteInterne')}
        </p>
        <time dateTime={suivi.cree_le} className="text-xs text-texte-discret">
          {formaterDateHeure(suivi.cree_le, langue)}
        </time>
      </div>
      {changement !== null && <p className="mt-0.5 text-sm text-texte-secondaire">{changement}</p>}
      {commentaire !== '' && (
        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-texte">{commentaire}</p>
      )}
      <p className="mt-1 text-xs text-texte-discret">
        {t('avis.fiche.historique.par', { auteur: suivi.utilisateur.nom })}
      </p>
    </li>
  )
}

export function HistoriqueAvis({ suivis }: Proprietes) {
  const { t } = utiliserLangue()

  return (
    <section aria-labelledby="titre-historique-avis" className="rounded-xl border border-bordure bg-surface p-4">
      <h2 id="titre-historique-avis" className="font-titre text-lg font-bold text-texte">
        {t('avis.fiche.historique.titre')}
      </h2>
      {suivis.length === 0 ? (
        <p className="mt-2 text-sm text-texte-discret">{t('avis.fiche.historique.aucun')}</p>
      ) : (
        <ol className="mt-3 divide-y divide-bordure">
          {suivis.map((suivi) => (
            <LigneHistorique key={suivi.id} suivi={suivi} />
          ))}
        </ol>
      )}
    </section>
  )
}