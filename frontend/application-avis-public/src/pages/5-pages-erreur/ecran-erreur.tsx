import { useEffect, useRef } from 'react'
import { SelecteurLangue } from '../../composants/selecteur-langue'
import { utiliserLangue } from '../../hooks/utiliser-langue'
import type { ErreurService } from '../../services/api-public'

type Proprietes = {
  erreur: ErreurService
  // Si elle est donnee, le bouton Reessayer s'affiche pour les erreurs qui peuvent passer.
  reessayer?: () => void
}

// Code d'erreur du backend -> groupe de textes (traductions : erreur.<groupe>).
const GROUPES: Record<string, string> = {
  QR_INCONNU: 'qrInconnu',
  QR_DESACTIVE: 'qrDesactive',
  ORGANISATION_SUSPENDUE: 'organisationSuspendue',
  QUESTIONNAIRE_INACTIF: 'questionnaireInactif',
  EVENEMENT_PAS_COMMENCE: 'evenementPasCommence',
  EVENEMENT_TERMINE: 'evenementTermine',
  AVIS_DEJA_DONNE: 'avisDejaDonne',
  HORS_CONNEXION: 'horsConnexion',
  TROP_DE_REQUETES: 'tropDeRequetes',
}

// Erreurs qui peuvent disparaitre en reessayant (reseau, limite, panne du serveur).
function peutReessayer(erreur: ErreurService, groupe: string): boolean {
  return (
    groupe === 'horsConnexion' ||
    groupe === 'tropDeRequetes' ||
    groupe === 'generique' ||
    erreur.statut >= 500
  )
}

// Ecran E5 : page d'erreur claire, sans jargon, dans la langue du client.
export function EcranErreur({ erreur, reessayer }: Proprietes) {
  const { t } = utiliserLangue()
  const titreRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    window.scrollTo(0, 0)
    titreRef.current?.focus()
  }, [])

  const groupe = GROUPES[erreur.code] ?? 'generique'
  const afficherReessayer = reessayer !== undefined && peutReessayer(erreur, groupe)
  // Un avis deja donne n'est pas une panne : on l'accueille avec une coche.
  const rassurant = groupe === 'avisDejaDonne'

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col gap-6 px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-6">
      <div className="flex justify-end">
        <SelecteurLangue />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <div
          aria-hidden="true"
          className={
            'flex h-24 w-24 items-center justify-center rounded-full ' +
            (rassurant ? 'bg-[var(--couleur-principale)]' : 'bg-slate-200')
          }
        >
          <svg
            viewBox="0 0 24 24"
            className={'h-12 w-12 ' + (rassurant ? 'stroke-white' : 'stroke-slate-600')}
            fill="none"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {rassurant ? <path d="M5 12.5l4.5 4.5L19 7.5" /> : <path d="M12 6v8M12 18h.01" />}
          </svg>
        </div>

        <div className="flex flex-col gap-3">
          <h1
            ref={titreRef}
            tabIndex={-1}
            className="text-2xl font-bold text-slate-900 outline-none"
          >
            {t(`erreur.${groupe}.titre`)}
          </h1>
          <p className="text-lg text-slate-700">{t(`erreur.${groupe}.message`)}</p>
        </div>

        {afficherReessayer ? (
          <button
            type="button"
            onClick={reessayer}
            className="flex h-14 w-full items-center justify-center rounded-xl bg-[var(--couleur-principale)] text-lg font-semibold text-white shadow-sm active:opacity-90"
          >
            {t('erreur.reessayer')}
          </button>
        ) : null}
      </div>
    </main>
  )
}