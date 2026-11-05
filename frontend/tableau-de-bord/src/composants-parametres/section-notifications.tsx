import { useId } from 'react'
import { utiliserLangue } from '../hooks/utiliser-langue'
import type { EtatPreferences } from '../hooks/utiliser-parametres'
import type { PreferencesNotifications } from '../types/notifications'

// Section "Alertes par e-mail" de l'ecran E14 (jour 16), pour le Responsable et le Gestionnaire.
// Deux choix, qui ne concernent que l'utilisateur connecte :
// - un e-mail tout de suite pour chaque avis negatif ;
// - un seul resume par jour, a 08h00.
// Le choix est enregistre des qu'on clique, sans bouton. Ce composant n'appelle pas l'API :
// l'enregistrement vient de utiliserParametres, qui renvoie la preference a jour apres succes.

type Proprietes = {
  preferences: PreferencesNotifications
  etat: EtatPreferences
}

type ProprietesChoix = {
  nom: string
  libelle: string
  aide: string
  coche: boolean
  bloque: boolean
  surChoix: () => void
}

// Un choix (bouton radio) avec son texte d'aide.
function Choix({ nom, libelle, aide, coche, bloque, surChoix }: ProprietesChoix) {
  const idChamp = useId()
  const idAide = `${idChamp}-aide`

  return (
    <div className="flex items-start gap-3 rounded-md border border-bordure px-3 py-2">
      <input
        id={idChamp}
        type="radio"
        name={nom}
        checked={coche}
        disabled={bloque}
        aria-describedby={idAide}
        onChange={surChoix}
        className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-principale disabled:cursor-not-allowed"
      />
      <label htmlFor={idChamp} className="flex min-h-9 flex-1 cursor-pointer flex-col">
        <span className="text-sm font-semibold text-texte">{libelle}</span>
        <span id={idAide} className="text-xs text-texte-secondaire">
          {aide}
        </span>
      </label>
    </div>
  )
}

export function SectionNotifications({ preferences, etat }: Proprietes) {
  const { t } = utiliserLangue()
  const idTitre = useId()
  const nomGroupe = useId()

  const groupees = preferences.alertes_groupees

  // Etat de l'enregistrement : annonce aux lecteurs d'ecran (role status).
  function messageEtat(): string {
    if (etat.enCours) {
      return t('parametres.alertes.enregistrement')
    }
    return etat.succes ? t('parametres.notifications.succes') : ''
  }

  return (
    <section
      aria-labelledby={idTitre}
      className="rounded-lg border border-bordure bg-surface p-5 shadow-doux"
    >
      <h2 id={idTitre} className="font-titre text-lg font-bold text-texte">
        {t('parametres.notifications.titre')}
      </h2>
      <p className="mt-1 text-sm text-texte-secondaire">
        {t('parametres.notifications.description')}
      </p>

      <fieldset className="m-0 mt-4 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-2 p-0 text-sm font-semibold text-texte">
          {t('parametres.notifications.groupe')}
        </legend>
        <Choix
          nom={nomGroupe}
          libelle={t('parametres.notifications.immediates')}
          aide={t('parametres.notifications.immediatesAide')}
          coche={!groupees}
          bloque={etat.enCours}
          surChoix={() => void etat.changer(false)}
        />
        <Choix
          nom={nomGroupe}
          libelle={t('parametres.notifications.groupees')}
          aide={t('parametres.notifications.groupeesAide')}
          coche={groupees}
          bloque={etat.enCours}
          surChoix={() => void etat.changer(true)}
        />
      </fieldset>

      <p role="status" className="m-0 mt-3 min-h-5 text-sm text-succes">
        {messageEtat()}
      </p>
      {etat.erreur !== null && (
        <p role="alert" className="m-0 mt-1 text-sm text-erreur">
          {etat.erreur.statut === 0
            ? t('commun.erreurReseau')
            : t('parametres.notifications.erreur')}
        </p>
      )}
    </section>
  )
}