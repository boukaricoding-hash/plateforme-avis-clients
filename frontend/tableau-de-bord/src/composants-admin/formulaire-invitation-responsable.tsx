import { useId, useState, type FormEvent } from 'react'
import { utiliserLangue } from '../hooks/utiliser-langue'
import type { ActionInvitationResponsable } from '../hooks/utiliser-organisations-admin'
import type { OrganisationAdmin } from '../types/admin'

// Formulaire d'invitation du premier responsable d'une organisation (ecran E17, jour 23),
// administrateur DTS seulement.
// - une seule information : l'adresse e-mail (le role est toujours Responsable, sans site) ;
// - il sert juste apres la creation de l'organisation, et plus tard depuis sa fiche ;
// - apres l'envoi, un message dit si l'e-mail est parti. S'il a ete refuse, l'invitation existe
//   quand meme : le bouton "Renvoyer" la remplace (l'ancien lien ne marche plus) ;
// - une invitation ratee ne bloque rien : l'organisation existe deja.
// Ce composant n'appelle pas l'API : l'envoi vient de utiliserOrganisationsAdmin.
// Ici on garde seulement ce que la personne tape et on verifie avant l'envoi.
// La page appelle invitation.reinitialiser() avant d'ouvrir le formulaire : le resultat d'une
// autre organisation ne doit pas s'afficher ici.

type Proprietes = {
  organisation: OrganisationAdmin
  invitation: ActionInvitationResponsable
  // Vrai juste apres la creation : le titre dit que l'organisation vient d'etre creee.
  apresCreation?: boolean
  // false = le modele de questionnaire du secteur n'a pas pu etre copie (secteur sans modele) :
  // on le dit clairement, l'organisation existe quand meme. Absent ou true = rien a signaler.
  questionnaireCopie?: boolean
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

// Codes d'erreur de POST /admin/organisations/:id/inviter-responsable avec leur propre message.
const CODES_CONNUS = [
  'RESPONSABLE_EXISTANT',
  'DEJA_MEMBRE',
  'COMPTE_DESACTIVE',
  'ADRESSE_INDISPONIBLE',
  'TROP_DE_REQUETES',
]

export function FormulaireInvitationResponsable({
  organisation,
  invitation,
  apresCreation = false,
  questionnaireCopie = true,
  surFermer,
}: Proprietes) {
  const { t } = utiliserLangue()
  const idTitre = useId()
  const idEmail = useId()
  const idErreurEmail = useId()

  // Ce que la personne tape.
  const [email, setEmail] = useState('')
  // Les messages d'erreur apparaissent apres le premier essai d'envoi.
  const [tentative, setTentative] = useState(false)

  const emailPropre = email.trim()

  let erreurEmail: string | null = null
  if (tentative) {
    if (emailPropre === '') {
      erreurEmail = t('admin.organisations.invitation.emailObligatoire')
    } else if (!FORME_EMAIL.test(emailPropre)) {
      erreurEmail = t('admin.organisations.invitation.emailInvalide')
    }
  }

  async function envoyer(evenement: FormEvent<HTMLFormElement>): Promise<void> {
    evenement.preventDefault()
    setTentative(true)
    if (emailPropre === '' || !FORME_EMAIL.test(emailPropre)) {
      return
    }
    await invitation.inviter(organisation.id, emailPropre)
  }

  function fermer(): void {
    invitation.reinitialiser()
    surFermer()
  }

  // Apres un envoi reussi : on repart d'un formulaire vide pour utiliser une autre adresse.
  function autreAdresse(): void {
    invitation.reinitialiser()
    setEmail('')
    setTentative(false)
  }

  // Renvoie l'invitation a la meme adresse (la nouvelle remplace l'ancienne).
  async function renvoyer(adresse: string): Promise<void> {
    await invitation.inviter(organisation.id, adresse)
  }

  // Le message d'echec ne s'affiche qu'apres un essai dans CE formulaire.
  let messageErreur: string | null = null
  if (tentative && invitation.erreur !== null) {
    if (invitation.erreur.statut === 0) {
      messageErreur = t('commun.erreurReseau')
    } else if (invitation.erreur.statut === 403) {
      messageErreur = t('admin.organisations.invitation.erreurs.droits')
    } else if (invitation.erreur.statut === 404) {
      messageErreur = t('admin.organisations.invitation.erreurs.introuvable')
    } else if (CODES_CONNUS.includes(invitation.erreur.code)) {
      messageErreur = t(`admin.organisations.invitation.erreurs.${invitation.erreur.code}`)
    } else {
      messageErreur = t('admin.organisations.invitation.erreurs.generique')
    }
  }

  const entete = (
    <>
      <h2 id={idTitre} className="font-titre text-lg font-bold text-texte">
        {t('admin.organisations.invitation.titre')}
      </h2>
      <p className="mt-1 text-sm text-texte-secondaire">
        {apresCreation
          ? t('admin.organisations.invitation.organisationCreee', { organisation: organisation.nom })
          : t('admin.organisations.invitation.sousTitre', { organisation: organisation.nom })}
      </p>
      {!questionnaireCopie && (
        <p role="status" className="mt-3 text-sm text-alerte">
          {t('admin.organisations.invitation.modeleAbsent')}
        </p>
      )}
    </>
  )

  // --- Apres l'envoi : on dit si l'e-mail est parti ---------------------------------------------

  if (invitation.resultat !== null) {
    const adresse = invitation.resultat.invitation.email
    const emailEnvoye = invitation.resultat.email_envoye
    return (
      <section
        aria-labelledby={idTitre}
        className="rounded-lg border border-bordure bg-surface p-5 shadow-doux"
      >
        {entete}
        <p role="status" className={`mt-4 text-sm ${emailEnvoye ? 'text-succes' : 'text-alerte'}`}>
          {emailEnvoye
            ? t('admin.organisations.invitation.envoyee', { email: adresse })
            : t('admin.organisations.invitation.emailNonEnvoye', { email: adresse })}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {!emailEnvoye && (
            <button
              type="button"
              disabled={invitation.enCours}
              aria-busy={invitation.enCours}
              onClick={() => void renvoyer(adresse)}
              className={CLASSE_BOUTON_PRINCIPAL}
            >
              {invitation.enCours
                ? t('admin.organisations.invitation.envoiEnCours')
                : t('admin.organisations.invitation.renvoyer')}
            </button>
          )}
          <button
            type="button"
            disabled={invitation.enCours}
            onClick={autreAdresse}
            className={CLASSE_BOUTON_SECONDAIRE}
          >
            {t('admin.organisations.invitation.autreAdresse')}
          </button>
          <button
            type="button"
            disabled={invitation.enCours}
            onClick={fermer}
            className={emailEnvoye ? CLASSE_BOUTON_PRINCIPAL : CLASSE_BOUTON_SECONDAIRE}
          >
            {t('admin.organisations.invitation.fermer')}
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
      {entete}

      <form
        onSubmit={(evenement) => void envoyer(evenement)}
        noValidate
        className="mt-4 flex flex-col gap-5"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor={idEmail} className="text-sm font-semibold text-texte">
            {t('admin.organisations.invitation.email')}
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
          <p className="m-0 text-xs text-texte-secondaire">
            {t('admin.organisations.invitation.aide')}
          </p>
          {erreurEmail !== null && (
            <p id={idErreurEmail} role="alert" className="m-0 text-xs text-erreur">
              {erreurEmail}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={invitation.enCours}
            aria-busy={invitation.enCours}
            className={CLASSE_BOUTON_PRINCIPAL}
          >
            {invitation.enCours
              ? t('admin.organisations.invitation.envoiEnCours')
              : t('admin.organisations.invitation.envoyer')}
          </button>
          <button
            type="button"
            disabled={invitation.enCours}
            onClick={fermer}
            className={CLASSE_BOUTON_SECONDAIRE}
          >
            {apresCreation
              ? t('admin.organisations.invitation.plusTard')
              : t('admin.organisations.invitation.annuler')}
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