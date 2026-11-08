import { useId, useState } from 'react'
import { Navigate } from 'react-router'
import { CarteInvitation } from '../../composants-utilisateurs/carte-invitation'
import { CarteUtilisateur } from '../../composants-utilisateurs/carte-utilisateur'
import { FormulaireInvitation } from '../../composants-utilisateurs/formulaire-invitation'
import { FormulaireModification } from '../../composants-utilisateurs/formulaire-modification'
import { utiliserLangue } from '../../hooks/utiliser-langue'
import {
  utiliserListeUtilisateurs,
  type ActionsUtilisateurs,
} from '../../hooks/utiliser-utilisateurs'
import type { ErreurService } from '../../services/api'
import type { InvitationEnAttente } from '../../types/utilisateurs-admin'

// Ecran E13 : utilisateurs, roles et perimetres (jour 18), Responsable seulement.
// - Equipe en cartes "profil" (role, perimetre, derniere connexion, statut) ; la derniere carte,
//   en pointilles, ouvre l'invitation d'un collaborateur par e-mail (Responsable ou Gestionnaire
//   avec ses sites) ;
// - modification du role et des sites, activation et desactivation (sur chaque carte) ;
// - invitations en attente en cartes "fantomes", avec un bouton "Renvoyer" (l'invitation est
//   remplacee, l'ancien lien ne marche plus).
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

const CLASSE_GRILLE = 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'

const CODES_INVITATION_CONNUS = [
  'SITES_INVALIDES',
  'DEJA_MEMBRE',
  'COMPTE_DESACTIVE',
  'ADRESSE_INDISPONIBLE',
]

export function PageUtilisateurs() {
  const { t } = utiliserLangue()
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
  // au-dessus des cartes une fois le formulaire ferme.
  const [masquerErreur, setMasquerErreur] = useState(false)

  // Le Gestionnaire et l'administrateur DTS n'ont rien a gerer ici.
  if (acces === 'aucun') {
    return <Navigate to="/" replace />
  }

  // Les actions des cartes (activer, desactiver) font reapparaitre leurs propres erreurs.
  const actionsCartes: ActionsUtilisateurs = {
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

  // Message d'echec d'une action des cartes (activer, desactiver), hors formulaire de modification.
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
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header>
        <h1 className="font-titre text-2xl font-bold text-texte">{t('utilisateurs.titre')}</h1>
        <p className="mt-1 text-texte-secondaire">{t('utilisateurs.sousTitre')}</p>
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
        <section aria-labelledby={idTitreListe}>
          <h2 id={idTitreListe} className="m-0 font-titre text-lg font-bold text-texte">
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

          <div className={`mt-3 ${CLASSE_GRILLE}`}>
            {utilisateurs.map((utilisateur) => (
              <CarteUtilisateur
                key={utilisateur.id}
                utilisateur={utilisateur}
                estMoi={utilisateur.id === moiId}
                actions={actionsCartes}
                surModifier={(u) => setPanneau({ type: 'modification', id: u.id })}
              />
            ))}

            <button
              type="button"
              onClick={ouvrirInvitation}
              className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-bordure-forte p-6 text-texte-secondaire transition-colors hover:border-principale hover:bg-surface hover:text-principale"
            >
              <span
                aria-hidden="true"
                className="flex size-14 items-center justify-center rounded-full bg-accent-fond text-principale"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="size-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </span>
              <span className="text-sm font-semibold">{t('utilisateurs.inviter')}</span>
            </button>
          </div>
        </section>
      )}

      {invitations !== null && (
        <section aria-labelledby={idTitreInvitations}>
          <h2 id={idTitreInvitations} className="m-0 font-titre text-lg font-bold text-texte">
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
            <div className={`mt-3 ${CLASSE_GRILLE}`}>
              {invitations.map((enAttente) => (
                <CarteInvitation
                  key={enAttente.id}
                  enAttente={enAttente}
                  enCours={invitation.enCours}
                  surRenvoyer={(a) => void renvoyer(a)}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}