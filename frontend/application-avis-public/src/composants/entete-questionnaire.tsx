import type { QuestionnairePublic } from '../types/avis-public'

type Proprietes = {
  pointContact: QuestionnairePublic['point_contact']
}

// Nom du point de contact (« Table 12 »).
// Le logo et le nom de l'organisation sont affiches en haut de la page.
export function EnteteQuestionnaire({ pointContact }: Proprietes) {
  return (
    <header className="flex flex-col items-center text-center">
      <p className="rounded-full bg-surface/60 px-4 py-1 text-base font-semibold text-texte-secondaire backdrop-blur-sm">
        {pointContact.nom}
      </p>
    </header>
  )
}