import { useState } from 'react'
import type { QuestionnairePublic } from '../types/avis-public'

type Proprietes = {
  organisation: QuestionnairePublic['organisation']
  pointContact: QuestionnairePublic['point_contact']
}

// Logo (ou initiale si pas de logo) et nom du point de contact (« Table 12 »).
// Le nom de l'organisation est affiche en haut a gauche de la page, pas ici.
export function EnteteQuestionnaire({ organisation, pointContact }: Proprietes) {
  // Si l'image du logo ne charge pas, on affiche l'initiale.
  const [logoEnErreur, setLogoEnErreur] = useState(false)

  const afficherLogo = organisation.logo_url !== null && !logoEnErreur
  const initiale = organisation.nom.trim().charAt(0).toUpperCase()

  return (
    <header className="flex flex-col items-center gap-4 text-center">
      {afficherLogo ? (
        <img
          src={organisation.logo_url ?? undefined}
          alt={organisation.nom}
          onError={() => setLogoEnErreur(true)}
          className="h-24 w-24 rounded-3xl bg-surface/70 object-contain p-1.5 shadow-doux"
        />
      ) : (
        <div
          aria-hidden="true"
          className="flex h-24 w-24 items-center justify-center rounded-3xl bg-principale font-titre text-4xl font-bold text-texte-sur-principale shadow-moyen"
        >
          {initiale}
        </div>
      )}
      <p className="rounded-full bg-surface/60 px-4 py-1 text-base font-semibold text-texte-secondaire backdrop-blur-sm">
        {pointContact.nom}
      </p>
    </header>
  )
}