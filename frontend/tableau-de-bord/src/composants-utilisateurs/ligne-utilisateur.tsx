import { useState } from 'react'
import { utiliserLangue } from '../hooks/utiliser-langue'
import type { ActionsUtilisateurs } from '../hooks/utiliser-utilisateurs'
import type { UtilisateurListe } from '../types/utilisateurs-admin'

// Une ligne du tableau des utilisateurs (ecran E13, jour 18).
// Colonnes, dans cet ordre (la page ecrit les memes en-tetes) :
// utilisateur (nom et e-mail), role, perimetre, derniere connexion, statut, actions.
// Le Responsable voit toute l'organisation ; le Gestionnaire, seulement ses sites.
// Sur sa propre ligne : pas de bouton (le serveur refuse de modifier ou de desactiver son compte).
// Desactiver demande une confirmation sur place ; activer et modifier sont immediats.
// Ce composant n'appelle pas l'API : les actions viennent de utiliserListeUtilisateurs.
// Les erreurs d'action s'affichent une seule fois, au-dessus du tableau (la page s'en charge).

type Proprietes = {
  utilisateur: UtilisateurListe
  // true pour la ligne du compte connecte.
  estMoi: boolean
  actions: ActionsUtilisateurs
  // Ouvre le formulaire de modification (role et sites) pour cet utilisateur.
  surModifier: (utilisateur: UtilisateurListe) => void
}

const CLASSE_BOUTON =
  'min-h-11 rounded-md border border-bordure-champ px-3 text-sm font-semibold text-texte transition-colors hover:bg-accent-fond disabled:cursor-not-allowed disabled:opacity-60'

// Date et heure dans la langue choisie ; valeur invalide = tiret.
function formaterDateHeure(valeur: string, langue: string): string {
  const date = new Date(valeur)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }
  return new Intl.DateTimeFormat(langue === 'en' ? 'en-GB' : 'fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function LigneUtilisateur({ utilisateur, estMoi, actions, surModifier }: Proprietes) {
  const { t, langue } = utiliserLangue()
  const [confirmation, setConfirmation] = useState(false)

  const estResponsable = utilisateur.role === 'RESPONSABLE'

  // Perimetre : le Responsable voit tout ; le Gestionnaire, la liste de ses sites.
  let perimetre: string
  if (estResponsable) {
    perimetre = t('utilisateurs.liste.touteOrganisation')
  } else if (utilisateur.sites.length === 0) {
    perimetre = t('utilisateurs.liste.aucunSite')
  } else {
    perimetre = utilisateur.sites.map((site) => site.nom).join(', ')
  }

  async function desactiver(): Promise<void> {
    const reussi = await actions.changerStatut(utilisateur.id, false)
    if (reussi) {
      setConfirmation(false)
    }
  }

  return (
    <tr className="border-t border-bordure align-middle">
      <td className="px-3 py-2 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-texte">{utilisateur.nom}</span>
          {estMoi && (
            <span className="rounded-full border border-bordure px-2 py-0.5 text-xs font-semibold text-texte-secondaire">
              {t('utilisateurs.liste.moi')}
            </span>
          )}
        </div>
        <div className="break-all text-xs text-texte-secondaire">{utilisateur.email}</div>
      </td>

      <td className="px-3 py-2 text-sm text-texte-secondaire">
        {t(`utilisateurs.roles.${utilisateur.role}`)}
      </td>

      <td className="px-3 py-2 text-sm text-texte-secondaire">{perimetre}</td>

      <td className="px-3 py-2 text-sm text-texte-secondaire">
        {utilisateur.derniere_connexion !== null
          ? formaterDateHeure(utilisateur.derniere_connexion, langue)
          : t('utilisateurs.liste.jamaisConnecte')}
      </td>

      <td className="px-3 py-2 text-sm">
        <span
          className={`rounded-full border border-bordure px-2 py-0.5 text-xs font-semibold ${
            utilisateur.actif ? 'text-succes' : 'text-texte-secondaire'
          }`}
        >
          {utilisateur.actif ? t('utilisateurs.liste.actif') : t('utilisateurs.liste.desactive')}
        </span>
      </td>

      <td className="px-3 py-2 text-sm">
        {!estMoi && !confirmation && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={actions.enCours}
              onClick={() => surModifier(utilisateur)}
              className={CLASSE_BOUTON}
            >
              {t('utilisateurs.liste.modifier')}
            </button>
            {utilisateur.actif ? (
              <button
                type="button"
                disabled={actions.enCours}
                onClick={() => setConfirmation(true)}
                className={CLASSE_BOUTON}
              >
                {t('utilisateurs.liste.desactiver')}
              </button>
            ) : (
              <button
                type="button"
                disabled={actions.enCours}
                aria-busy={actions.enCours}
                onClick={() => void actions.changerStatut(utilisateur.id, true)}
                className={CLASSE_BOUTON}
              >
                {t('utilisateurs.liste.activer')}
              </button>
            )}
          </div>
        )}

        {!estMoi && confirmation && (
          <div className="flex flex-col gap-2" role="group">
            <p className="m-0 text-xs text-texte">
              {t('utilisateurs.liste.confirmerDesactivation', { nom: utilisateur.nom })}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={actions.enCours}
                aria-busy={actions.enCours}
                onClick={() => void desactiver()}
                className="min-h-11 rounded-md bg-principale px-3 text-sm font-semibold text-texte-sur-principale transition-colors hover:bg-principale-fonce disabled:cursor-not-allowed disabled:opacity-60"
              >
                {t('utilisateurs.liste.confirmer')}
              </button>
              <button
                type="button"
                disabled={actions.enCours}
                onClick={() => setConfirmation(false)}
                className={CLASSE_BOUTON}
              >
                {t('utilisateurs.liste.annuler')}
              </button>
            </div>
          </div>
        )}
      </td>
    </tr>
  )
}