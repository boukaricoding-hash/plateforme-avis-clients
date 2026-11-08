import { useState } from 'react'
import { utiliserLangue } from '../hooks/utiliser-langue'
import type { InvitationEnAttente } from '../types/utilisateurs-admin'

// Carte "fantome" d'une invitation en attente (ecran E13, jour 18).
// Meme gabarit que la carte d'un utilisateur, mais bordure en pointilles et fond transparent :
// la personne n'a pas encore rejoint l'organisation.
// - rond en pointilles avec une enveloppe, e-mail, role, perimetre, invitee par ;
// - date d'expiration et delai ("dans 6 jours"), en couleur chaude quand il reste moins de 2 jours ;
// - bouton "Renvoyer" toujours visible (l'invitation est remplacee, l'ancien lien ne marche plus).
// Ce composant n'appelle pas l'API : la page lui donne l'action et l'etat "en cours".
// Le resultat ou l'echec du renvoi s'affiche une seule fois, au-dessus de la grille (la page s'en charge).

type Proprietes = {
  enAttente: InvitationEnAttente
  // true pendant qu'un envoi est en cours (le bouton est alors bloque).
  enCours: boolean
  surRenvoyer: (enAttente: InvitationEnAttente) => void
}

// Moins de 2 jours avant l'expiration : le delai passe en couleur chaude.
const SEUIL_URGENT_MS = 2 * 24 * 60 * 60 * 1000

// Date complete dans la langue choisie ; valeur invalide = tiret.
function formaterDate(valeur: string, langue: string): string {
  const date = new Date(valeur)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }
  return new Intl.DateTimeFormat(langue === 'en' ? 'en-GB' : 'fr-FR', {
    dateStyle: 'medium',
  }).format(date)
}

// "dans 6 jours", "demain"... dans la langue choisie ; valeur invalide = tiret.
function delaiExpiration(valeur: string, langue: string, maintenant: number): string {
  const date = new Date(valeur)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }
  const format = new Intl.RelativeTimeFormat(langue === 'en' ? 'en-GB' : 'fr-FR', {
    numeric: 'auto',
  })
  const ecart = date.getTime() - maintenant
  if (Math.abs(ecart) < 24 * 60 * 60 * 1000) {
    return format.format(Math.round(ecart / (60 * 60 * 1000)), 'hour')
  }
  return format.format(Math.round(ecart / (24 * 60 * 60 * 1000)), 'day')
}

export function CarteInvitation({ enAttente, enCours, surRenvoyer }: Proprietes) {
  const { t, langue } = utiliserLangue()
  // Heure de reference prise a l'affichage de la carte (le delai n'a pas besoin d'etre vivant).
  const [maintenant] = useState(() => Date.now())

  // Perimetre : le Responsable voit tout ; le Gestionnaire, la liste de ses sites.
  let perimetre: string
  if (enAttente.role === 'RESPONSABLE') {
    perimetre = t('utilisateurs.liste.touteOrganisation')
  } else if (enAttente.sites.length === 0) {
    perimetre = t('utilisateurs.liste.aucunSite')
  } else {
    perimetre = enAttente.sites.map((site) => site.nom).join(', ')
  }

  const dateExpiration = new Date(enAttente.expire_le)
  const urgent =
    !Number.isNaN(dateExpiration.getTime()) &&
    dateExpiration.getTime() - maintenant < SEUIL_URGENT_MS

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-dashed border-bordure-forte bg-surface/60">
      <div className="flex flex-1 flex-col items-center px-5 pb-5 pt-6 text-center">
        <div
          aria-hidden="true"
          className="flex size-14 items-center justify-center rounded-full border-2 border-dashed border-bordure-forte bg-surface-douce text-texte-secondaire"
        >
          <svg
            viewBox="0 0 24 24"
            className="size-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="5" width="18" height="14" rx="2.5" />
            <path d="m3.5 7 8.5 6 8.5-6" />
          </svg>
        </div>

        <h3 className="m-0 mt-3 break-all text-base font-semibold text-texte">{enAttente.email}</h3>

        <span className="mt-3 rounded-full border border-bordure-forte px-3 py-1 text-xs font-semibold text-texte-secondaire">
          {t(`utilisateurs.roles.${enAttente.role}`)}
        </span>

        <p className="m-0 mt-3 line-clamp-2 text-sm text-texte-secondaire">{perimetre}</p>

        {enAttente.invite_par_nom !== null && (
          <p className="m-0 mt-1 text-xs text-texte-secondaire">
            {t('utilisateurs.invitations.invitePar')} {enAttente.invite_par_nom}
          </p>
        )}

        <p className="m-0 mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-texte-secondaire">
          <span>
            {t('utilisateurs.invitations.expire')} {formaterDate(enAttente.expire_le, langue)}
          </span>
          <span
            className={`rounded-full bg-accent-fond px-2 py-0.5 font-semibold ${
              urgent ? 'text-note-moyenne' : 'text-texte-secondaire'
            }`}
          >
            {delaiExpiration(enAttente.expire_le, langue, maintenant)}
          </span>
        </p>
      </div>

      <div className="border-t border-dashed border-bordure-forte px-4 py-3">
        <button
          type="button"
          disabled={enCours}
          aria-busy={enCours}
          onClick={() => surRenvoyer(enAttente)}
          className="min-h-11 w-full rounded-lg bg-surface-douce px-3 text-sm font-semibold text-texte transition-colors hover:bg-accent-fond disabled:cursor-not-allowed disabled:opacity-60"
        >
          {t('utilisateurs.invitations.renvoyer')}
        </button>
      </div>
    </article>
  )
}