import { useId, useState } from 'react'
import { Navigate } from 'react-router'
import { FormulaireInvitation } from '../../composants-utilisateurs/formulaire-invitation'
import { FormulaireModification } from '../../composants-utilisateurs/formulaire-modification'
import { LigneUtilisateur } from '../../composants-utilisateurs/ligne-utilisateur'
import { utiliserLangue } from '../../hooks/utiliser-langue'
import {
  utiliserListeUtilisateurs,
  type ActionsUtilisateurs,
} from '../../hooks/utiliser-utilisateurs'
import type { ErreurService } from '../../services/api'
import type { InvitationEnAttente } from '../../types/utilisateurs-admin'

// Ecran E13 : utilisateurs, roles et perimetres (jour 18), Responsable seulement.
// - Liste des utilisateurs de l'organisation (actifs ou non) avec role, perimetre et statut ;
// - invitation d'un collaborateur par e-mail (Responsable ou Gestionnaire avec ses sites) ;
// - modification du role et des sites, activation et desactivation ;
// - invitations en attente, avec un bouton "Renvoyer" (l'invitation est remplacee, l'ancien lien
//   ne marche plus).
// Le Gestionnaire et l'administrateur DTS n'ont rien a gerer ici : ils sont renvoyes a l'accueil.
// La page n'appelle pas l'API : tout vient de utiliserListeUtilisateurs.

type PropsEchec = {
  erreur: ErreurService
  surReessayer: () => void
}

// Echec du chargement : pas de reseau (statut 0) ou erreur generale, avec "Reessayer".
function BlocEchec({ erreur, surReessayer }: PropsEchec) {
  const { t } = utiliserLangue()

  return (
    <div className="rounded-lg border border-bordure bg-surface p-5 shadow-doux">
      <p role="alert" className="m-0 text-sm text-erreur">
        {erreur.statut === 0 ? t('commun.erreurReseau') : t('utilisateurs.erreur')}
      </p>
      <button
        type="button"
        onClick={surReessayer}
        className="mt-3 min-h-11 rounded-md border border-bordure-champ px-4 text-sm font-semibold text-texte transition-colors hover:bg-accent-fond"
      >
        {t('commun.reessayer')}
      </button>
    </div>
  )
}

// Ce que montre le panneau sous l'en-tete : rien, l'invitation ou la modification d'un utilisateur.
type Panneau = { type: 'aucun' } | { type: 'invitation' } | { type: 'modification'; id: string }

const CLASSE_BOUTON =
  'min-h-11 rounded-md border border-bordure-champ px-3 text-sm font-semibold text-texte transition-colors hover:bg-accent-fond disabled:cursor-not-allowed disabled:opacity-60'

const CODES_INVITATION_CONNUS = [
  'SITES_INVALIDES',
  'DEJA_MEMBRE',
  'COMPTE_DESACTIVE',
  'ADRESSE_INDISPONIBLE',
]

// Date dans la langue choisie ; valeur invalide = tiret.
function formaterDate(valeur: string, langue: string): string {
  const date = new Date(valeur)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }
  return new Intl.DateTimeFormat(langue === 'en' ? 'en-GB' : 'fr-FR', {
    dateStyle: 'medium',
  }).format(date)
}

export function PageUtilisateurs() {
  const { t, langue } = utiliserLangue()
  const idTitreListe = useId()
  const idTitreInvitations = useId()
  const {
    acces,
    moiId,
    utilisateurs,
    invitations,
    chargement,
    erreur,
    sites,
    erreurSites,
    recharger,
    invitation,
    actions,
  } = utiliserListeUtilisateurs()

  const [panneau, setPanneau] = useState<Panneau>({ type: 'aucun' })
  // Vrai apres un echec dans le formulaire de modification : son message n'est pas repete
  // au-dessus du tableau une fois le formulaire ferme.
  const [masquerErreur, setMasquerErreur] = useState(false)

  // Le Gestionnaire et l'administrateur DTS n'ont rien a gerer ici.
  if (acces === 'aucun') {
    return <Navigate to="/" replace />
  }

  // Les actions du tableau (activer, desactiver) font reapparaitre leurs propres erreurs.
  const actionsTableau: ActionsUtilisateurs = {
    ...actions,
    changerStatut: async (id, actif) => {
      setMasquerErreur(false)
      return actions.changerStatut(id, actif)
    },
  }

  function ouvrirInvitation(): void {
    invitation.reinitialiser()
    setPanneau({ type: 'invitation' })
  }

  function fermerPanneau(): void {
    setPanneau({ type: 'aucun' })
  }

  function fermerModification(): void {
    if (actions.erreur !== null) {
      setMasquerErreur(true)
    }
    setPanneau({ type: 'aucun' })
  }

  async function renvoyer(enAttente: InvitationEnAttente): Promise<void> {
    await invitation.inviter({
      email: enAttente.email,
      role: enAttente.role,
      site_ids: enAttente.sites.map((site) => site.id),
    })
  }

  const utilisateurModifie =
    panneau.type === 'modification'
      ? (utilisateurs?.find((u) => u.id === panneau.id) ?? null)
      : null

  // Message d'echec d'une action du tableau (activer, desactiver), hors formulaire de modification.
  let messageAction: string | null = null
  if (panneau.type !== 'modification' && !masquerErreur && actions.erreur !== null) {
    if (actions.erreur.statut === 0) {
      messageAction = t('commun.erreurReseau')
    } else if (actions.erreur.code === 'ACTION_SUR_SOI_INTERDITE') {
      messageAction = t('utilisateurs.liste.erreurs.ACTION_SUR_SOI_INTERDITE')
    } else if (actions.erreur.statut === 404) {
      messageAction = t('utilisateurs.liste.erreurs.INTROUVABLE')
    } else if (actions.erreur.statut === 403) {
      messageAction = t('utilisateurs.liste.erreurs.droits')
    } else {
      messageAction = t('utilisateurs.liste.erreurs.generique')
    }
  }

  const messageEnregistre =
    panneau.type !== 'modification' && !masquerErreur && actions.succes
      ? t('utilisateurs.liste.enregistre')
      : ''

  // Resultat ou echec d'un renvoi d'invitation (hors formulaire d'invitation ouvert).
  let messageRenvoi: { texte: string; erreur: boolean } | null = null
  if (panneau.type !== 'invitation') {
    if (invitation.resultat !== null) {
      messageRenvoi = {
        texte: invitation.resultat.email_envoye
          ? t('utilisateurs.formulaire.envoyee', { email: invitation.resultat.invitation.email })
          : t('utilisateurs.formulaire.emailNonEnvoye', {
              email: invitation.resultat.invitation.email,
            }),
        erreur: !invitation.resultat.email_envoye,
      }
    } else if (invitation.erreur !== null) {
      let texte: string
      if (invitation.erreur.statut === 0) {
        texte = t('commun.erreurReseau')
      } else if (invitation.erreur.statut === 403) {
        texte = t('utilisateurs.formulaire.erreurs.droits')
      } else if (CODES_INVITATION_CONNUS.includes(invitation.erreur.code)) {
        texte = t(`utilisateurs.formulaire.erreurs.${invitation.erreur.code}`)
      } else {
        texte = t('utilisateurs.formulaire.erreurs.generique')
      }
      messageRenvoi = { texte, erreur: true }
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-titre text-2xl font-bold text-texte">{t('utilisateurs.titre')}</h1>
          <p className="mt-1 text-texte-secondaire">{t('utilisateurs.sousTitre')}</p>
        </div>
        <button
          type="button"
          onClick={ouvrirInvitation}
          className="min-h-11 rounded-md bg-principale px-4 text-sm font-semibold text-texte-sur-principale transition-colors hover:bg-principale-fonce"
        >
          {t('utilisateurs.inviter')}
        </button>
      </header>

      {panneau.type === 'invitation' && (
        <FormulaireInvitation
          sites={sites}
          erreurSites={erreurSites}
          invitation={invitation}
          surFermer={fermerPanneau}
        />
      )}
      {panneau.type === 'modification' && utilisateurModifie !== null && (
        <FormulaireModification
          key={utilisateurModifie.id}
          utilisateur={utilisateurModifie}
          sites={sites}
          erreurSites={erreurSites}
          actions={actions}
          surFermer={fermerModification}
        />
      )}

      {chargement && (
        <p role="status" className="m-0 text-sm text-texte-secondaire">
          {t('utilisateurs.chargement')}
        </p>
      )}
      {erreur !== null && utilisateurs === null && (
        <BlocEchec erreur={erreur} surReessayer={recharger} />
      )}

      {utilisateurs !== null && (
        <section
          aria-labelledby={idTitreListe}
          className="rounded-lg border border-bordure bg-surface p-5 shadow-doux"
        >
          <h2 id={idTitreListe} className="font-titre text-lg font-bold text-texte">
            {t('utilisateurs.liste.titre', { nombre: utilisateurs.length })}
          </h2>

          <p role="status" className="m-0 mt-2 min-h-5 text-sm text-succes">
            {messageEnregistre}
          </p>
          {messageAction !== null && (
            <p role="alert" className="m-0 mt-1 text-sm text-erreur">
              {messageAction}
            </p>
          )}

          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[44rem] border-collapse text-left">
              <thead>
                <tr>
                  <th scope="col" className="px-3 py-2 text-xs font-semibold text-texte-secondaire">
                    {t('utilisateurs.colonnes.utilisateur')}
                  </th>
                  <th scope="col" className="px-3 py-2 text-xs font-semibold text-texte-secondaire">
                    {t('utilisateurs.colonnes.role')}
                  </th>
                  <th scope="col" className="px-3 py-2 text-xs font-semibold text-texte-secondaire">
                    {t('utilisateurs.colonnes.perimetre')}
                  </th>
                  <th scope="col" className="px-3 py-2 text-xs font-semibold text-texte-secondaire">
                    {t('utilisateurs.colonnes.derniereConnexion')}
                  </th>
                  <th scope="col" className="px-3 py-2 text-xs font-semibold text-texte-secondaire">
                    {t('utilisateurs.colonnes.statut')}
                  </th>
                  <th scope="col" className="px-3 py-2 text-xs font-semibold text-texte-secondaire">
                    {t('utilisateurs.colonnes.actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {utilisateurs.map((utilisateur) => (
                  <LigneUtilisateur
                    key={utilisateur.id}
                    utilisateur={utilisateur}
                    estMoi={utilisateur.id === moiId}
                    actions={actionsTableau}
                    surModifier={(u) => setPanneau({ type: 'modification', id: u.id })}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {invitations !== null && (
        <section
          aria-labelledby={idTitreInvitations}
          className="rounded-lg border border-bordure bg-surface p-5 shadow-doux"
        >
          <h2 id={idTitreInvitations} className="font-titre text-lg font-bold text-texte">
            {t('utilisateurs.invitations.titre', { nombre: invitations.length })}
          </h2>

          {messageRenvoi !== null && (
            <p
              role={messageRenvoi.erreur ? 'alert' : 'status'}
              className={`m-0 mt-2 text-sm ${messageRenvoi.erreur ? 'text-erreur' : 'text-succes'}`}
            >
              {messageRenvoi.texte}
            </p>
          )}

          {invitations.length === 0 ? (
            <p className="m-0 mt-3 text-sm text-texte-secondaire">
              {t('utilisateurs.invitations.vide')}
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[44rem] border-collapse text-left">
                <thead>
                  <tr>
                    <th scope="col" className="px-3 py-2 text-xs font-semibold text-texte-secondaire">
                      {t('utilisateurs.invitations.email')}
                    </th>
                    <th scope="col" className="px-3 py-2 text-xs font-semibold text-texte-secondaire">
                      {t('utilisateurs.colonnes.role')}
                    </th>
                    <th scope="col" className="px-3 py-2 text-xs font-semibold text-texte-secondaire">
                      {t('utilisateurs.colonnes.perimetre')}
                    </th>
                    <th scope="col" className="px-3 py-2 text-xs font-semibold text-texte-secondaire">
                      {t('utilisateurs.invitations.invitePar')}
                    </th>
                    <th scope="col" className="px-3 py-2 text-xs font-semibold text-texte-secondaire">
                      {t('utilisateurs.invitations.expire')}
                    </th>
                    <th scope="col" className="px-3 py-2 text-xs font-semibold text-texte-secondaire">
                      {t('utilisateurs.colonnes.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {invitations.map((enAttente) => (
                    <tr key={enAttente.id} className="border-t border-bordure align-middle">
                      <td className="break-all px-3 py-2 text-sm font-semibold text-texte">
                        {enAttente.email}
                      </td>
                      <td className="px-3 py-2 text-sm text-texte-secondaire">
                        {t(`utilisateurs.roles.${enAttente.role}`)}
                      </td>
                      <td className="px-3 py-2 text-sm text-texte-secondaire">
                        {enAttente.role === 'RESPONSABLE'
                          ? t('utilisateurs.liste.touteOrganisation')
                          : enAttente.sites.length === 0
                            ? t('utilisateurs.liste.aucunSite')
                            : enAttente.sites.map((site) => site.nom).join(', ')}
                      </td>
                      <td className="px-3 py-2 text-sm text-texte-secondaire">
                        {enAttente.invite_par_nom ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-sm text-texte-secondaire">
                        {formaterDate(enAttente.expire_le, langue)}
                      </td>
                      <td className="px-3 py-2 text-sm">
                        <button
                          type="button"
                          disabled={invitation.enCours}
                          aria-busy={invitation.enCours}
                          onClick={() => void renvoyer(enAttente)}
                          className={CLASSE_BOUTON}
                        >
                          {t('utilisateurs.invitations.renvoyer')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  )
}