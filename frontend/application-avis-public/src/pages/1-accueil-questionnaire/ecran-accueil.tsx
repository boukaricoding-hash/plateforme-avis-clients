import { EnteteQuestionnaire } from '../../composants/entete-questionnaire'
import { SelecteurLangue } from '../../composants/selecteur-langue'
import { utiliserLangue } from '../../hooks/utiliser-langue'
import type { QuestionnairePublic } from '../../types/avis-public'
import { choisirTexte } from '../../utilitaires/textes-multilingues'

type Proprietes = {
  donnees: QuestionnairePublic
  // Appelee quand le client touche le bouton Commencer.
  commencer: () => void
}

// Ecran E1 : logo, nom, point de contact (ex. "Table 12"), message d'accueil,
// choix de la langue et bouton Commencer.
export function EcranAccueil({ donnees, commencer }: Proprietes) {
  const { langue, t } = utiliserLangue()

  // Message du questionnaire dans la langue choisie, sinon le message par defaut.
  const messageChoisi = choisirTexte(donnees.questionnaire.message_accueil, langue).trim()
  const message = messageChoisi !== '' ? messageChoisi : t('accueil.messageParDefaut')

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col gap-8 px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-6">
      <div className="flex justify-end">
        <SelecteurLangue />
      </div>

      <EnteteQuestionnaire
        organisation={donnees.organisation}
        pointContact={donnees.point_contact}
      />

      <section className="flex flex-col items-center gap-3 text-center">
        <h2 className="text-xl font-semibold text-slate-900">{t('accueil.titreParDefaut')}</h2>
        <p className="whitespace-pre-line text-base text-slate-700">{message}</p>
        <p className="text-sm text-slate-500">{t('accueil.duree')}</p>
      </section>

      <div className="mt-auto">
        <button
          type="button"
          onClick={commencer}
          className="flex h-14 w-full items-center justify-center rounded-xl bg-[var(--couleur-principale)] text-lg font-semibold text-white shadow-sm active:opacity-90"
        >
          {t('accueil.commencer')}
        </button>
      </div>
    </main>
  )
}