import { useEffect, useRef } from 'react'
import { utiliserLangue } from '../../hooks/utiliser-langue'
import type { QuestionnairePublic } from '../../types/avis-public'
import { choisirTexte } from '../../utilitaires/textes-multilingues'

type Proprietes = {
  donnees: QuestionnairePublic
}

// Ecran E4 : remerciement apres l'envoi de l'avis.
export function EcranRemerciement({ donnees }: Proprietes) {
  const { langue, t } = utiliserLangue()
  const titreRef = useRef<HTMLHeadingElement>(null)

  // A l'arrivee : en haut de la page et focus sur le titre (lecteurs d'ecran).
  useEffect(() => {
    window.scrollTo(0, 0)
    titreRef.current?.focus()
  }, [])

  // Message du questionnaire dans la langue choisie, sinon le message par defaut.
  const messageChoisi = choisirTexte(donnees.questionnaire.message_remerciement, langue).trim()
  const message = messageChoisi !== '' ? messageChoisi : t('remerciement.messageParDefaut')

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col items-center justify-center gap-6 px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-6 text-center">
      <div
        aria-hidden="true"
        className="flex h-24 w-24 items-center justify-center rounded-full bg-[var(--couleur-principale)]"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-12 w-12 stroke-white"
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </div>

      <div className="flex flex-col gap-3">
        <h1
          ref={titreRef}
          tabIndex={-1}
          className="text-3xl font-bold text-slate-900 outline-none"
        >
          {t('remerciement.titreParDefaut')}
        </h1>
        <p className="whitespace-pre-line text-lg text-slate-700">{message}</p>
        <p className="text-base text-slate-500">{t('remerciement.confirmation')}</p>
      </div>

      <p className="text-sm text-slate-500">{donnees.organisation.nom}</p>
      <p className="text-sm text-slate-500">{t('remerciement.fermer')}</p>
    </main>
  )
}