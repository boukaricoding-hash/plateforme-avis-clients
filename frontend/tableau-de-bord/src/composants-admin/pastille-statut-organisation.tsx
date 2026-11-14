import { utiliserLangue } from '../hooks/utiliser-langue'
import type { StatutOrganisation } from '../types/admin'
import { CLASSE_BASE_PASTILLE } from '../utilitaires/statuts-avis'

type Proprietes = {
  statut: StatutOrganisation
}

// Les classes Tailwind sont ecrites en entier : Tailwind ne trouve pas celles qu'on assemble.
const CLASSES_STATUT: Record<StatutOrganisation, string> = {
  ESSAI: 'border-info bg-surface text-info',
  ACTIF: 'border-succes bg-surface text-succes',
  SUSPENDU: 'border-erreur bg-surface text-erreur',
}

// Pastille du statut d'une organisation (essai, actif, suspendu) dans l'ecran E17.
// Meme forme que les pastilles des avis. Le statut est toujours ecrit en toutes lettres :
// la couleur seule ne suffit pas a le comprendre.
// Texte : admin.organisations.statuts.ESSAI, .ACTIF et .SUSPENDU.
export function PastilleStatutOrganisation({ statut }: Proprietes) {
  const { t } = utiliserLangue()

  return (
    <span className={`${CLASSE_BASE_PASTILLE} ${CLASSES_STATUT[statut]}`}>
      {t(`admin.organisations.statuts.${statut}`)}
    </span>
  )
}