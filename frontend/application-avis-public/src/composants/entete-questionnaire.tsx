import { useState } from 'react'
import type { QuestionnairePublic } from '../types/avis-public'

type Proprietes = {
  organisation: QuestionnairePublic['organisation']
  pointContact: QuestionnairePublic['point_contact']
}

// Logo (ou initiale si pas de logo), nom de l'organisation et nom du point de contact (« Table 12 »).
export function EnteteQuestionnaire({ organisation, pointContact }: Proprietes) {
  // Si l'image du logo ne charge pas, on affiche l'initiale.
  const [logoEnErreur, setLogoEnErreur] = useState(false)

  const afficherLogo = organisation.logo_url !== null && !logoEnErreur
  const initiale = organisation.nom.trim().charAt(0).toUpperCase()

  return (
    <header className="flex flex-col items-center gap-3 text-center">
      {afficherLogo ? (
        <img
          src={organisation.logo_url ?? undefined}
          alt={organisation.nom}
          onError={() => setLogoEnErreur(true)}
          className="h-20 w-20 rounded-2xl bg-white object-contain p-1 shadow-sm"
        />
      ) : (
        <div
          aria-hidden="true"
          className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[var(--couleur-principale)] text-3xl font-bold text-white"
        >
          {initiale}
        </div>
      )}
      <h1 className="text-2xl font-bold text-slate-900">{organisation.nom}</h1>
      <p className="rounded-full bg-slate-100 px-4 py-1 text-base font-semibold text-slate-700">
        {pointContact.nom}
      </p>
    </header>
  )
}