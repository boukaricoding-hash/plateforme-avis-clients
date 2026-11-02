import { utiliserLangue } from '../hooks/utiliser-langue'
import type { StatutTraitement } from '../types/tableau-de-bord'
import { classePastilleStatut, cleTexteStatut } from '../utilitaires/statuts-avis'

type Proprietes = {
  statut: StatutTraitement
}

// Pastille du statut de traitement d'un avis (Nouveau, En cours, Traite, Ignore).
// Meme aspect que dans les avis recents de l'accueil. Le statut est toujours ecrit en toutes
// lettres : la couleur seule ne suffit pas a le comprendre.
export function PastilleStatut({ statut }: Proprietes) {
  const { t } = utiliserLangue()

  return <span className={classePastilleStatut(statut)}>{t(cleTexteStatut(statut))}</span>
}