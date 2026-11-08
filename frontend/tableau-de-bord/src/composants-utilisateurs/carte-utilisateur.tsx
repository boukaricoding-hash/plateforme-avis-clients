import { useState } from 'react'
import { utiliserLangue } from '../hooks/utiliser-langue'
import type { ActionsUtilisateurs } from '../hooks/utiliser-utilisateurs'
import type { UtilisateurListe } from '../types/utilisateurs-admin'

// Carte "profil" d'un utilisateur (ecran E13, jour 18). Elle remplace la ligne du tableau.
// - Bandeau en degrade doux (une teinte par role, gris si le compte est desactive) ;
// - grand rond d'initiales qui chevauche le bandeau, nom, e-mail, role ;
// - perimetre et derniere connexion ("il y a 2 h", la date complete est dans l'infobulle) ;
// - actions en bas de carte : elles apparaissent au survol ou au focus clavier, et restent
//   toujours visibles sur ecran tactile (pas de survol possible).
// Sur sa propre carte : pas d'action (le serveur refuse de modifier ou de desactiver son compte).
// Desactiver demande une confirmation sur place ; activer et modifier sont immediats.
// Ce composant n'appelle pas l'API : les actions viennent de utiliserListeUtilisateurs.
// Les erreurs d'action s'affichent une seule fois, au-dessus de la grille (la page s'en charge).

type Proprietes = {
  utilisateur: UtilisateurListe
  // true pour la carte du compte connecte.
  estMoi: boolean
  actions: ActionsUtilisateurs
  // Ouvre le formulaire de modification (role et sites) pour cet utilisateur.
  surModifier: (utilisateur: UtilisateurListe) => void
}

// Degrades du bandeau : ils reprennent les variables des deux themes (clair et sombre).
const DEGRADE_RESPONSABLE =
  'linear-gradient(135deg, color-mix(in srgb, var(--couleur-principale) 30%, transparent), color-mix(in srgb, var(--couleur-decor) 10%, transparent))'
const DEGRADE_GESTIONNAIRE =
  'linear-gradient(135deg, color-mix(in srgb, var(--carte-sarcelle) 28%, transparent), color-mix(in srgb, var(--carte-bleu) 10%, transparent))'

// Barre d'actions : cachee tant qu'il n'y a ni survol ni focus, sauf sur ecran tactile.
const CLASSE_SURVOL =
  'transition duration-200 motion-reduce:transition-none [@media(hover:hover)]:translate-y-1 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:translate-y-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:translate-y-0 [@media(hover:hover)]:group-focus-within:opacity-100'

const CLASSE_BOUTON =
  'min-h-11 flex-1 rounded-lg px-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60'

// Initiales du nom : premiere lettre des deux premiers mots.
function initiales(nom: string): string {
  const mots = nom.trim().split(/\s+/).filter((mot) => mot.length > 0)
  const premiere = Array.from(mots[0] ?? '')[0] ?? ''
  const seconde = Array.from(mots[1] ?? '')[0] ?? ''
  const resultat = (premiere + seconde).toUpperCase()
  return resultat === '' ? '?' : resultat
}

// "il y a 2 h", "hier"... dans la langue choisie ; valeur invalide = tiret.
function tempsEcoule(valeur: string, langue: string, maintenant: number): string {
  const date = new Date(valeur)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }
  const format = new Intl.RelativeTimeFormat(langue === 'en' ? 'en-GB' : 'fr-FR', {
    numeric: 'auto',
  })
  const minutes = Math.round((date.getTime() - maintenant) / 60000)
  const absolu = Math.abs(minutes)
  if (absolu < 60) {
    return format.format(minutes, 'minute')
  }
  if (absolu < 1440) {
    return format.format(Math.round(minutes / 60), 'hour')
  }
  if (absolu < 43200) {
    return format.format(Math.round(minutes / 1440), 'day')
  }
  if (absolu < 525600) {
    return format.format(Math.round(minutes / 43200), 'month')
  }
  return format.format(Math.round(minutes / 525600), 'year')
}

// Date et heure completes dans la langue choisie, pour l'infobulle.
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

export function CarteUtilisateur({ utilisateur, estMoi, actions, surModifier }: Proprietes) {
  const { t, langue } = utiliserLangue()
  const [confirmation, setConfirmation] = useState(false)
  // Heure de reference figee a l'affichage de la carte (le "il y a" n'a pas besoin d'etre vivant).
  const [maintenant] = useState(() => Date.now())

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

  const derniereConnexion = utilisateur.derniere_connexion
  const texteConnexion =
    derniereConnexion !== null
      ? tempsEcoule(derniereConnexion, langue, maintenant)
      : t('utilisateurs.liste.jamaisConnecte')
  const infobulleConnexion =
    derniereConnexion !== null ? formaterDateHeure(derniereConnexion, langue) : undefined

  async function desactiver(): Promise<void> {
    const reussi = await actions.changerStatut(utilisateur.id, false)
    if (reussi) {
      setConfirmation(false)
    }
  }

  const degrade = estResponsable ? DEGRADE_RESPONSABLE : DEGRADE_GESTIONNAIRE

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-bordure bg-surface shadow-doux transition-shadow duration-300 hover:shadow-moyen motion-reduce:transition-none">
      <div
        className={`relative h-20 ${utilisateur.actif ? '' : 'bg-surface-douce'}`}
        style={utilisateur.actif ? { background: degrade } : undefined}
      >
        <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-surface/80 px-2.5 py-1 text-xs font-semibold backdrop-blur-sm">
          <span
            aria-hidden="true"
            className={`size-1.5 rounded-full ${utilisateur.actif ? 'bg-succes' : 'bg-texte-discret'}`}
          />
          <span className={utilisateur.actif ? 'text-succes' : 'text-texte-secondaire'}>
            {utilisateur.actif ? t('utilisateurs.liste.actif') : t('utilisateurs.liste.desactive')}
          </span>
        </span>
      </div>

      <div className="flex flex-1 flex-col items-center px-5 pb-5 text-center">
        <div
          aria-hidden="true"
          className={`-mt-8 flex size-16 items-center justify-center rounded-full font-titre text-xl font-bold ring-4 ring-surface ${
            utilisateur.actif
              ? 'bg-principale text-texte-sur-principale'
              : 'bg-accent-fond text-texte-secondaire'
          }`}
        >
          {initiales(utilisateur.nom)}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <h3 className="m-0 font-titre text-lg font-bold text-texte">{utilisateur.nom}</h3>
          {estMoi && (
            <span className="rounded-full border border-bordure px-2 py-0.5 text-xs font-semibold text-texte-secondaire">
              {t('utilisateurs.liste.moi')}
            </span>
          )}
        </div>
        <p className="m-0 mt-0.5 break-all text-xs text-texte-secondaire">{utilisateur.email}</p>

        <span className="mt-3 rounded-full bg-accent-fond px-3 py-1 text-xs font-semibold text-principale">
          {t(`utilisateurs.roles.${utilisateur.role}`)}
        </span>

        <ul className="m-0 mt-4 flex list-none flex-col gap-2 p-0 text-sm text-texte-secondaire">
          <li className="flex items-start justify-center gap-2">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="mt-0.5 size-4 shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
              <circle cx="12" cy="9.5" r="2.5" />
            </svg>
            <span className="line-clamp-2">{perimetre}</span>
          </li>
          <li className="flex items-center justify-center gap-2" title={infobulleConnexion}>
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="size-4 shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
            <span className="sr-only">{t('utilisateurs.colonnes.derniereConnexion')} : </span>
            <span>{texteConnexion}</span>
          </li>
        </ul>
      </div>

      {!estMoi && !confirmation && (
        <div className={`flex gap-2 border-t border-bordure px-4 py-3 ${CLASSE_SURVOL}`}>
          <button
            type="button"
            disabled={actions.enCours}
            onClick={() => surModifier(utilisateur)}
            className={`${CLASSE_BOUTON} bg-surface-douce text-texte hover:bg-accent-fond`}
          >
            {t('utilisateurs.liste.modifier')}
          </button>
          {utilisateur.actif ? (
            <button
              type="button"
              disabled={actions.enCours}
              onClick={() => setConfirmation(true)}
              className={`${CLASSE_BOUTON} text-texte-secondaire hover:bg-surface-douce hover:text-erreur`}
            >
              {t('utilisateurs.liste.desactiver')}
            </button>
          ) : (
            <button
              type="button"
              disabled={actions.enCours}
              aria-busy={actions.enCours}
              onClick={() => void actions.changerStatut(utilisateur.id, true)}
              className={`${CLASSE_BOUTON} bg-principale text-texte-sur-principale hover:bg-principale-fonce`}
            >
              {t('utilisateurs.liste.activer')}
            </button>
          )}
        </div>
      )}

      {!estMoi && confirmation && (
        <div className="flex flex-col gap-3 border-t border-bordure px-4 py-3" role="group">
          <p className="m-0 text-xs text-texte">
            {t('utilisateurs.liste.confirmerDesactivation', { nom: utilisateur.nom })}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={actions.enCours}
              aria-busy={actions.enCours}
              onClick={() => void desactiver()}
              className={`${CLASSE_BOUTON} bg-principale text-texte-sur-principale hover:bg-principale-fonce`}
            >
              {t('utilisateurs.liste.confirmer')}
            </button>
            <button
              type="button"
              disabled={actions.enCours}
              onClick={() => setConfirmation(false)}
              className={`${CLASSE_BOUTON} bg-surface-douce text-texte hover:bg-accent-fond`}
            >
              {t('utilisateurs.liste.annuler')}
            </button>
          </div>
        </div>
      )}
    </article>
  )
}