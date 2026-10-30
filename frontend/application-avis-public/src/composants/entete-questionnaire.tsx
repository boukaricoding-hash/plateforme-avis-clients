import type { QuestionnairePublic } from '../types/avis-public'

type Proprietes = {
  pointContact: QuestionnairePublic['point_contact']
}

// Nom du point de contact (« Table 12 »), le plus visible de l'ecran : grand, tres gras, brun presque noir.
// Pas de pastille ni de bordure. Un liseré clair net et une ombre douce le detachent du fond.
// La taille s'adapte a la largeur du telephone (de 36 a 60 px) ; un nom long passe a la ligne.
// Le logo et le nom de l'organisation sont affiches en haut de la page.
export function EnteteQuestionnaire({ pointContact }: Proprietes) {
  return (
    <header className="max-w-full text-center">
      <p className="break-words font-sans text-[clamp(2.25rem,13vw,3.75rem)] font-black uppercase leading-none tracking-wide text-[#1a110e] [text-shadow:0_2px_0_rgb(255_255_255/0.8),0_6px_16px_rgb(42_31_28/0.25)]">
        {pointContact.nom}
      </p>
    </header>
  )
}