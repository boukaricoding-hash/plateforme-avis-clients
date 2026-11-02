import { utiliserLangue } from '../hooks/utiliser-langue'
import type { LigneSuivi } from '../types/avis'
import { formaterDateHeure } from '../utilitaires/periodes'
import { cleTexteStatut } from '../utilitaires/statuts-avis'
import { IconeHorloge } from './icones-avis'

// Bloc "Historique" du detail d'un avis (page unique, jour 15 design) : qui a fait quoi, et quand.
// Version compacte de l'ecran E9. Une ligne par changement de statut ou par note interne,
// du plus recent au plus ancien (l'ordre vient de l'API et du hook, ce composant ne trie pas).
// Seules les 3 lignes les plus recentes sont montrees, suivies de "+N" pour les autres :
// la page ne defile pas, il n'y a pas de place pour tout l'historique.
// Ce composant n'appelle pas l'API : il affiche les lignes deja chargees.
// Le type de chaque ligne est ecrit en toutes lettres : pas seulement une couleur ou une icone.
// Le style vient de styles/avis.css (classes avis-panneau, avis-chrono, avis-chrono-item).

type Proprietes = {
  suivis: LigneSuivi[]
}

// Nombre de lignes montrees dans le bloc
const LIGNES_VISIBLES = 3

type ProprietesLigne = {
  suivi: LigneSuivi
}

// Deux lignes : le type et la date, puis le detail (changement de statut et commentaire)
// coupe par "..." s'il est trop long. Le texte complet reste dans l'infobulle (title).
function LigneHistorique({ suivi }: ProprietesLigne) {
  const { t, langue } = utiliserLangue()

  const estChangement = suivi.type === 'CHANGEMENT_STATUT'
  const commentaire = suivi.commentaire?.trim() ?? ''

  // "Nouveau → En cours". Si un des deux statuts manque, on n'affiche pas la partie statuts.
  const changement =
    estChangement && suivi.ancien_statut !== null && suivi.nouveau_statut !== null
      ? t('avis.fiche.historique.statutVers', {
          ancien: t(cleTexteStatut(suivi.ancien_statut)),
          nouveau: t(cleTexteStatut(suivi.nouveau_statut)),
        })
      : ''

  const detail = [changement, commentaire].filter((partie) => partie !== '').join(' · ')
  const dateEtAuteur = `${formaterDateHeure(suivi.cree_le, langue)} · ${t('avis.fiche.historique.par', { auteur: suivi.utilisateur.nom })}`

  return (
    <li className="avis-chrono-item">
      <p className="m-0 flex min-w-0 items-baseline gap-2">
        <span className="shrink-0 font-semibold">
          {estChangement
            ? t('avis.fiche.historique.changementStatut')
            : t('avis.fiche.historique.noteInterne')}
        </span>
        <time
          dateTime={suivi.cree_le}
          className="truncate text-xs text-texte-secondaire"
          title={dateEtAuteur}
        >
          {dateEtAuteur}
        </time>
      </p>
      {detail !== '' && (
        <p className="m-0 truncate text-texte-secondaire" title={detail}>
          {detail}
        </p>
      )}
    </li>
  )
}

export function HistoriqueAvis({ suivis }: Proprietes) {
  const { t } = utiliserLangue()

  const masquees = Math.max(0, suivis.length - LIGNES_VISIBLES)

  return (
    <section aria-labelledby="titre-historique-avis" className="avis-panneau">
      <h3 id="titre-historique-avis" className="avis-panneau-titre">
        <IconeHorloge />
        {t('avis.fiche.historique.titre')}
      </h3>
      {suivis.length === 0 ? (
        <p className="m-0 text-sm text-texte-discret">{t('avis.fiche.historique.aucun')}</p>
      ) : (
        <>
          <ol className="avis-chrono">
            {suivis.slice(0, LIGNES_VISIBLES).map((suivi) => (
              <LigneHistorique key={suivi.id} suivi={suivi} />
            ))}
          </ol>
          {masquees > 0 && (
            <p
              className="m-0 pl-[22px] pt-1 text-xs font-semibold text-texte-secondaire"
              title={t('avis.detail.autresHistorique', { nombre: masquees })}
            >
              <span aria-hidden="true">+{masquees}</span>
              <span className="sr-only">{t('avis.detail.autresHistorique', { nombre: masquees })}</span>
            </p>
          )}
        </>
      )}
    </section>
  )
}