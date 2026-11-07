import { useId, useState, type FormEvent } from 'react'
import { utiliserLangue } from '../hooks/utiliser-langue'
import type { ActionInviter } from '../hooks/utiliser-utilisateurs'
import type { ErreurService } from '../services/api'
import type { Site } from '../types/sites-points'
import type { CorpsInvitation, RoleInvitable } from '../types/utilisateurs-admin'

// Formulaire d'invitation d'un collaborateur (ecran E13, jour 18), Responsable seulement.
// - adresse e-mail, role (Responsable ou Gestionnaire) ;
// - un Gestionnaire doit avoir au moins un site ; un Responsable voit toute l'organisation
//   (le serveur ignore ses sites : on n'affiche donc pas le choix).
// Apres l'envoi, un message dit si l'e-mail est parti. S'il a ete refuse, l'invitation existe
// quand meme : renvoyer la meme adresse la remplace (l'ancien lien ne marche plus).
// Ce composant n'appelle pas l'API : l'envoi vient de utiliserListeUtilisateurs.
// Ici on garde seulement ce que la personne tape et on verifie avant l'envoi.

type Proprietes = {
  // null tant que les sites ne sont pas charges.
  sites: Site[] | null
  erreurSites: ErreurService | null
  invitation: ActionInviter
  // Appele au clic sur "Annuler" ou "Fermer" : la page ferme le formulaire.
  surFermer: () => void
}

// Longueur maximale reprise du backend ; le serveur refait toujours la verification.
const LONGUEUR_EMAIL = 254

// Verification simple de la forme (le serveur fait la vraie verification).
const FORME_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const CLASSE_BOUTON_PRINCIPAL =
  'min-h-11 rounded-md bg-principale px-4 text-sm font-semibold text-texte-sur-principale transition-colors hover:bg-principale-fonce disabled:cursor-not-allowed disabled:opacity-60'
const CLASSE_BOUTON_SECONDAIRE =
  'min-h-11 rounded-md border border-bordure-champ px-4 text-sm font-semibold text-texte transition-colors hover:bg-accent-fond disabled:cursor-not-allowed disabled:opacity-60'

// Codes d'erreur de POST /utilisateurs/inviter avec leur propre message.
const CODES_CONNUS = ['SITES_INVALIDES', 'DEJA_MEMBRE', 'COMPTE_DESACTIVE', 'ADRESSE_INDISPONIBLE']

export function FormulaireInvitation({ sites, erreurSites, invitation, surFermer }: Proprietes) {
  const { t } = utiliserLangue()
  const idTitre = useId()
  const idEmail = useId()
  const idRole = useId()
  const idErreurEmail = useId()
  const idErreurSites = useId()

  // Ce que la personne tape. Par defaut Gestionnaire : le droit le plus limite.
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<RoleInvitable>('GESTIONNAIRE')
  const [sitesChoisis, setSitesChoisis] = useState<string[]>([])
  // Les messages d'erreur apparaissent apres le premier essai d'envoi.
  const [tentative, setTentative] = useState(false)

  const emailPropre = email.trim()
  const estGestionnaire = role === 'GESTIONNAIRE'

  let erreurEmail: string | null = null
  if (tentative) {
    if (emailPropre === '') {
      erreurEmail = t('utilisateurs.formulaire.emailObligatoire')
    } else if (!FORME_EMAIL.test(emailPropre)) {
      erreurEmail = t('utilisateurs.formulaire.emailInvalide')
    }
  }

  const erreurSelectionSites =
    tentative && estGestionnaire && sitesChoisis.length === 0
      ? t('utilisateurs.formulaire.siteObligatoire')
      : null

  function basculerSite(id: string, coche: boolean): void {
    setSitesChoisis((avant) => (coche ? [...avant, id] : avant.filter((valeur) => valeur !== id)))
  }

  async function envoyer(evenement: FormEvent<HTMLFormElement>): Promise<void> {
    evenement.preventDefault()
    setTentative(true)
    if (emailPropre === '' || !FORME_EMAIL.test(emailPropre)) {
      return
    }
    if (estGestionnaire && sitesChoisis.length === 0) {
      return
    }

    const corps: CorpsInvitation = {
      email: emailPropre,
      role,
      site_ids: estGestionnaire ? sitesChoisis : [],
    }
    await invitation.inviter(corps)
  }

  function fermer(): void {
    invitation.reinitialiser()
    surFermer()
  }

  // Apres un envoi reussi : on repart d'un formulaire vide pour inviter quelqu'un d'autre.
  function inviterUneAutrePersonne(): void {
    invitation.reinitialiser()
    setEmail('')
    setRole('GESTIONNAIRE')
    setSitesChoisis([])
    setTentative(false)
  }

  // Le message d'echec ne s'affiche qu'apres un essai dans CE formulaire.
  let messageErreur: string | null = null
  if (tentative && invitation.erreur !== null) {
    if (invitation.erreur.statut === 0) {
      messageErreur = t('commun.erreurReseau')
    } else if (invitation.erreur.statut === 403) {
      messageErreur = t('utilisateurs.formulaire.erreurs.droits')
    } else if (CODES_CONNUS.includes(invitation.erreur.code)) {
      messageErreur = t(`utilisateurs.formulaire.erreurs.${invitation.erreur.code}`)
    } else {
      messageErreur = t('utilisateurs.formulaire.erreurs.generique')
    }
  }

  // --- Apres l'envoi : on dit si l'e-mail est parti ---------------------------------------------

  if (invitation.resultat !== null) {
    const emailEnvoye = invitation.resultat.email_envoye
    return (
      <section
        aria-labelledby={idTitre}
        className="rounded-lg border border-bordure bg-surface p-5 shadow-doux"
      >
        <h2 id={idTitre} className="font-titre text-lg font-bold text-texte">
          {t('utilisateurs.formulaire.titre')}
        </h2>
        <p
          role="status"
          className={`mt-4 text-sm ${emailEnvoye ? 'text-succes' : 'text-alerte'}`}
        >
          {emailEnvoye
            ? t('utilisateurs.formulaire.envoyee', { email: invitation.resultat.invitation.email })
            : t('utilisateurs.formulaire.emailNonEnvoye', {
                email: invitation.resultat.invitation.email,
              })}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" onClick={inviterUneAutrePersonne} className={CLASSE_BOUTON_PRINCIPAL}>
            {t('utilisateurs.formulaire.inviterAutre')}
          </button>
          <button type="button" onClick={fermer} className={CLASSE_BOUTON_SECONDAIRE}>
            {t('utilisateurs.formulaire.fermer')}
          </button>
        </div>
      </section>
    )
  }

  // --- Formulaire ----------------------------------------------------------------------------------

  return (
    <section
      aria-labelledby={idTitre}
      className="rounded-lg border border-bordure bg-surface p-5 shadow-doux"
    >
      <h2 id={idTitre} className="font-titre text-lg font-bold text-texte">
        {t('utilisateurs.formulaire.titre')}
      </h2>

      <form
        onSubmit={(evenement) => void envoyer(evenement)}
        noValidate
        className="mt-4 flex flex-col gap-5"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor={idEmail} className="text-sm font-semibold text-texte">
            {t('utilisateurs.formulaire.email')}
          </label>
          <input
            id={idEmail}
            type="email"
            inputMode="email"
            autoComplete="off"
            maxLength={LONGUEUR_EMAIL}
            required
            value={email}
            aria-invalid={erreurEmail !== null}
            aria-describedby={erreurEmail !== null ? idErreurEmail : undefined}
            onChange={(evenement) => setEmail(evenement.target.value)}
            className="min-h-11 w-full rounded-md border border-bordure-champ bg-fond px-3 text-sm text-texte"
          />
          {erreurEmail !== null && (
            <p id={idErreurEmail} role="alert" className="m-0 text-xs text-erreur">
              {erreurEmail}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={idRole} className="text-sm font-semibold text-texte">
            {t('utilisateurs.formulaire.role')}
          </label>
          <select
            id={idRole}
            value={role}
            onChange={(evenement) => setRole(evenement.target.value as RoleInvitable)}
            className="min-h-11 w-full rounded-md border border-bordure-champ bg-fond px-2 text-sm text-texte"
          >
            <option value="GESTIONNAIRE">{t('utilisateurs.roles.GESTIONNAIRE')}</option>
            <option value="RESPONSABLE">{t('utilisateurs.roles.RESPONSABLE')}</option>
          </select>
          <p className="m-0 text-xs text-texte-secondaire">
            {estGestionnaire
              ? t('utilisateurs.formulaire.aideGestionnaire')
              : t('utilisateurs.formulaire.aideResponsable')}
          </p>
        </div>

        {estGestionnaire && (
          <fieldset
            className="m-0 flex flex-col gap-2 border-0 p-0"
            aria-describedby={erreurSelectionSites !== null ? idErreurSites : undefined}
          >
            <legend className="mb-2 p-0 text-sm font-semibold text-texte">
              {t('utilisateurs.formulaire.sites')}
            </legend>

            {sites === null && erreurSites === null && (
              <p role="status" className="m-0 text-sm text-texte-secondaire">
                {t('utilisateurs.formulaire.chargementSites')}
              </p>
            )}
            {erreurSites !== null && (
              <p role="alert" className="m-0 text-sm text-erreur">
                {t('utilisateurs.formulaire.erreurSites')}
              </p>
            )}
            {sites !== null && sites.length === 0 && (
              <p className="m-0 text-sm text-texte-secondaire">
                {t('utilisateurs.formulaire.aucunSite')}
              </p>
            )}
            {sites?.map((site) => {
              const idSite = `${idRole}-site-${site.id}`
              return (
                <div key={site.id} className="flex min-h-11 items-center gap-3">
                  <input
                    id={idSite}
                    type="checkbox"
                    checked={sitesChoisis.includes(site.id)}
                    onChange={(evenement) => basculerSite(site.id, evenement.target.checked)}
                    className="h-5 w-5 accent-principale"
                  />
                  <label htmlFor={idSite} className="text-sm text-texte">
                    {site.actif
                      ? site.nom
                      : `${site.nom} ${t('utilisateurs.formulaire.siteDesactive')}`}
                  </label>
                </div>
              )
            })}

            {erreurSelectionSites !== null && (
              <p id={idErreurSites} role="alert" className="m-0 text-xs text-erreur">
                {erreurSelectionSites}
              </p>
            )}
          </fieldset>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={invitation.enCours}
            aria-busy={invitation.enCours}
            className={CLASSE_BOUTON_PRINCIPAL}
          >
            {invitation.enCours
              ? t('utilisateurs.formulaire.envoiEnCours')
              : t('utilisateurs.formulaire.envoyer')}
          </button>
          <button
            type="button"
            disabled={invitation.enCours}
            onClick={fermer}
            className={CLASSE_BOUTON_SECONDAIRE}
          >
            {t('utilisateurs.formulaire.annuler')}
          </button>
        </div>

        {messageErreur !== null && (
          <p role="alert" className="m-0 text-sm text-erreur">
            {messageErreur}
          </p>
        )}
      </form>
    </section>
  )
}