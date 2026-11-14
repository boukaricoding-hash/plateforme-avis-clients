import { useId } from 'react'
import { utiliserLangue } from '../hooks/utiliser-langue'
import type { ErreurService } from '../services/api'
import type { OrganisationAdmin } from '../types/admin'

// Confirmation sur place de la suspension ou de la reactivation d'une organisation
// (ecran E17, jour 23), administrateur DTS seulement. Meme principe que la desactivation
// d'un utilisateur dans l'ecran E13 : un bloc sous l'organisation, sans fenetre par-dessus.
// - suspension : le texte nomme l'organisation et dit que sa connexion et ses QR codes
//   sont bloques ;
// - reactivation : le texte dit qu'elle repasse au statut Actif et que tout refonctionne.
// Ce composant n'appelle pas l'API : la page lui donne l'action a lancer (surConfirmer).
// La page appelle actions.reinitialiser() avant d'afficher la confirmation : l'erreur d'une
// action precedente ne doit pas s'afficher ici.

type Proprietes = {
  action: 'suspendre' | 'reactiver'
  organisation: OrganisationAdmin
  // Vrai pendant l'envoi : les boutons sont bloques.
  enCours: boolean
  erreur: ErreurService | null
  // Lance la suspension ou la reactivation (la page ferme ensuite la confirmation si c'est fait).
  surConfirmer: () => void
  // Appele au clic sur "Annuler" : la page ferme la confirmation.
  surAnnuler: () => void
}

const CLASSE_BOUTON =
  'min-h-11 rounded-md px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60'

export function ConfirmationSuspension({
  action,
  organisation,
  enCours,
  erreur,
  surConfirmer,
  surAnnuler,
}: Proprietes) {
  const { t } = utiliserLangue()
  const idQuestion = useId()

  // Le message d'echec : reseau, droits, organisation inconnue, statut deja change ou erreur generale.
  let messageErreur: string | null = null
  if (erreur !== null) {
    if (erreur.statut === 0) {
      messageErreur = t('commun.erreurReseau')
    } else if (erreur.statut === 403) {
      messageErreur = t('admin.organisations.confirmation.erreurs.droits')
    } else if (erreur.statut === 404) {
      messageErreur = t('admin.organisations.confirmation.erreurs.introuvable')
    } else if (erreur.code === 'DEJA_SUSPENDUE' || erreur.code === 'PAS_SUSPENDUE') {
      messageErreur = t(`admin.organisations.confirmation.erreurs.${erreur.code}`)
    } else {
      messageErreur = t('admin.organisations.confirmation.erreurs.generique')
    }
  }

  return (
    <div
      role="group"
      aria-labelledby={idQuestion}
      className="flex flex-col gap-3 rounded-md border border-bordure bg-surface-douce p-4"
    >
      <p id={idQuestion} className="m-0 text-sm font-semibold text-texte">
        {t(`admin.organisations.confirmation.${action}.question`, { nom: organisation.nom })}
      </p>
      <p className="m-0 text-sm text-texte-secondaire">
        {t(`admin.organisations.confirmation.${action}.detail`)}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={enCours}
          aria-busy={enCours}
          onClick={surConfirmer}
          className={`${CLASSE_BOUTON} ${
            action === 'suspendre'
              ? 'bg-erreur text-surface hover:opacity-90'
              : 'bg-principale text-texte-sur-principale hover:bg-principale-fonce'
          }`}
        >
          {enCours
            ? t(`admin.organisations.confirmation.${action}.enCours`)
            : t(`admin.organisations.confirmation.${action}.confirmer`)}
        </button>
        {/* Le focus de depart est sur "Annuler" : une suspension ne part pas par erreur. */}
        <button
          type="button"
          autoFocus
          disabled={enCours}
          onClick={surAnnuler}
          className={`${CLASSE_BOUTON} border border-bordure-champ text-texte hover:bg-accent-fond`}
        >
          {t('admin.organisations.confirmation.annuler')}
        </button>
      </div>

      {messageErreur !== null && (
        <p role="alert" className="m-0 text-sm text-erreur">
          {messageErreur}
        </p>
      )}
    </div>
  )
}