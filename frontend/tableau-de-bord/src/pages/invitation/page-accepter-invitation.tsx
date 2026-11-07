import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { BoutonPrincipal } from '../../composants-communs/bouton-principal'
import { CadreAuthentification } from '../../composants-communs/cadre-authentification'
import { ChampTexte } from '../../composants-communs/champ-texte'
import { utiliserLangue } from '../../hooks/utiliser-langue'
import { ErreurService } from '../../services/api'
import { accepterInvitation, verifierInvitation } from '../../services/invitations'
import type { ReponseVerificationInvitation } from '../../types/utilisateurs-admin'

const LONGUEUR_MINIMALE = 8
const LONGUEUR_MAXIMALE_NOM = 120

const CLASSE_LIEN =
  'inline-flex min-h-11 items-center text-sm font-medium text-principale underline hover:text-principale-fonce'
const CLASSE_MESSAGE_ERREUR =
  'rounded-md border border-erreur bg-surface px-3 py-2 text-sm text-erreur'

// Etat de la verification du lien, faite une seule fois a l'ouverture de la page.
// - chargement : verification en cours
// - pret : le lien est bon, le formulaire s'affiche
// - lien_invalide : jeton absent, inconnu, expire ou deja utilise
// - sites_indisponibles : les sites de l'invitation n'existent plus
// - reseau : le serveur n'a pas pu etre joint
type EtatLien = 'chargement' | 'pret' | 'lien_invalide' | 'sites_indisponibles' | 'reseau'

// Page publique /invitation?jeton=... (jour 18) : l'invite donne son nom et choisit son mot de passe.
// Elle est hors de la zone connectee. Apres l'acceptation, l'invite n'est pas connecte :
// il est renvoye vers la page de connexion.
export function PageAccepterInvitation() {
  const { t } = utiliserLangue()
  const [parametres] = useSearchParams()
  const jeton = parametres.get('jeton') ?? ''

  // Sans jeton dans l'adresse, inutile d'appeler le serveur.
  const [etatLien, setEtatLien] = useState<EtatLien>(jeton === '' ? 'lien_invalide' : 'chargement')
  const [invitation, setInvitation] = useState<ReponseVerificationInvitation | null>(null)

  const [nom, setNom] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [erreurNom, setErreurNom] = useState('')
  const [erreurMotDePasse, setErreurMotDePasse] = useState('')
  const [erreurConfirmation, setErreurConfirmation] = useState('')
  const [erreurGenerale, setErreurGenerale] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [termine, setTermine] = useState(false)

  // Verification du lien a l'ouverture : affiche l'e-mail, l'organisation et le role.
  useEffect(() => {
    if (jeton === '') {
      return
    }
    // annule devient vrai si la page est quittee avant la reponse du serveur.
    let annule = false
    verifierInvitation(jeton)
      .then((reponse) => {
        if (annule) {
          return
        }
        setInvitation(reponse)
        setEtatLien('pret')
      })
      .catch((erreur: unknown) => {
        if (annule) {
          return
        }
        if (erreur instanceof ErreurService && erreur.code === 'SITES_INDISPONIBLES') {
          setEtatLien('sites_indisponibles')
        } else if (erreur instanceof ErreurService && erreur.statut === 0) {
          setEtatLien('reseau')
        } else {
          // LIEN_INVALIDE, limite de requetes (429) ou toute autre erreur : on ne revele rien de plus.
          setEtatLien('lien_invalide')
        }
      })
    return () => {
      annule = true
    }
  }, [jeton])

  async function surEnvoi(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault()
    setErreurNom('')
    setErreurMotDePasse('')
    setErreurConfirmation('')
    setErreurGenerale('')

    const nomNettoye = nom.trim()
    if (nomNettoye === '') {
      setErreurNom(t('invitation.erreurNomVide'))
      return
    }
    if (nomNettoye.length > LONGUEUR_MAXIMALE_NOM) {
      setErreurNom(t('invitation.erreurNomLong', { nombre: LONGUEUR_MAXIMALE_NOM }))
      return
    }
    if (motDePasse.length < LONGUEUR_MINIMALE) {
      setErreurMotDePasse(t('invitation.erreurCourt'))
      return
    }
    if (motDePasse !== confirmation) {
      setErreurConfirmation(t('invitation.erreurDifferents'))
      return
    }

    setEnCours(true)
    try {
      await accepterInvitation({ jeton, nom: nomNettoye, mot_de_passe: motDePasse })
      setTermine(true)
    } catch (erreur) {
      if (erreur instanceof ErreurService && erreur.code === 'LIEN_INVALIDE') {
        setEtatLien('lien_invalide')
      } else if (erreur instanceof ErreurService && erreur.code === 'SITES_INDISPONIBLES') {
        setEtatLien('sites_indisponibles')
      } else if (erreur instanceof ErreurService && erreur.code === 'MOT_DE_PASSE_INVALIDE') {
        // Par exemple : mot de passe trop courant. Le message vient du backend.
        setErreurMotDePasse(erreur.message)
      } else if (erreur instanceof ErreurService && erreur.statut === 429) {
        setErreurGenerale(t('connexion.erreurTropDeTentatives'))
      } else if (erreur instanceof ErreurService && erreur.statut === 0) {
        setErreurGenerale(t('commun.erreurReseau'))
      } else {
        setErreurGenerale(t('commun.erreurGenerique'))
      }
    } finally {
      setEnCours(false)
    }
  }

  // Compte active : l'invite va se connecter.
  if (termine) {
    return (
      <CadreAuthentification titre={t('invitation.titre')}>
        <p
          role="status"
          className="rounded-md border border-succes bg-surface px-3 py-2 text-sm text-succes"
        >
          {t('invitation.succes')}
        </p>
        <p className="mt-6 text-center">
          <Link to="/connexion" className={CLASSE_LIEN}>
            {t('invitation.versConnexion')}
          </Link>
        </p>
      </CadreAuthentification>
    )
  }

  // Verification en cours.
  if (etatLien === 'chargement') {
    return (
      <CadreAuthentification titre={t('invitation.titre')}>
        <p role="status" className="text-sm text-texte-secondaire">
          {t('commun.chargement')}
        </p>
      </CadreAuthentification>
    )
  }

  // Serveur injoignable : on peut reessayer en rechargeant la page.
  if (etatLien === 'reseau') {
    return (
      <CadreAuthentification titre={t('invitation.titre')}>
        <p role="alert" className={CLASSE_MESSAGE_ERREUR}>
          {t('commun.erreurReseau')}
        </p>
        <p className="mt-6 text-center">
          <button type="button" onClick={() => window.location.reload()} className={CLASSE_LIEN}>
            {t('commun.reessayer')}
          </button>
        </p>
      </CadreAuthentification>
    )
  }

  // Lien absent, invalide, deja utilise, expire, ou sites supprimes.
  if (etatLien === 'lien_invalide' || etatLien === 'sites_indisponibles' || invitation === null) {
    return (
      <CadreAuthentification titre={t('invitation.titre')}>
        <p role="alert" className={CLASSE_MESSAGE_ERREUR}>
          {etatLien === 'sites_indisponibles'
            ? t('invitation.erreurSitesIndisponibles')
            : t('invitation.erreurLienInvalide')}
        </p>
        <p className="mt-6 text-center">
          <Link to="/connexion" className={CLASSE_LIEN}>
            {t('commun.retourConnexion')}
          </Link>
        </p>
      </CadreAuthentification>
    )
  }

  return (
    <CadreAuthentification
      titre={t('invitation.titre')}
      sousTitre={t('invitation.explication', {
        organisation: invitation.organisation,
        role: t(`roles.${invitation.role}`).toLowerCase(),
      })}
    >
      <form onSubmit={(evenement) => void surEnvoi(evenement)} noValidate className="flex flex-col gap-4">
        {erreurGenerale !== '' && (
          <p role="alert" className={CLASSE_MESSAGE_ERREUR}>
            {erreurGenerale}
          </p>
        )}

        {/* L'adresse vient de l'invitation : elle ne se modifie pas. */}
        <div>
          <p className="block text-sm font-medium text-texte-secondaire">{t('invitation.email')}</p>
          <p className="flex min-h-11 items-center break-all border-b border-bordure-champ text-base text-texte">
            {invitation.email}
          </p>
        </div>

        <ChampTexte
          etiquette={t('invitation.nom')}
          type="text"
          name="nom"
          autoComplete="name"
          maxLength={LONGUEUR_MAXIMALE_NOM}
          value={nom}
          onChange={(evenement) => setNom(evenement.target.value)}
          erreur={erreurNom}
        />

        <ChampTexte
          etiquette={t('invitation.motDePasse')}
          type="password"
          name="nouveau_mot_de_passe"
          autoComplete="new-password"
          value={motDePasse}
          onChange={(evenement) => setMotDePasse(evenement.target.value)}
          erreur={erreurMotDePasse}
        />

        <ChampTexte
          etiquette={t('invitation.confirmation')}
          type="password"
          name="confirmation_mot_de_passe"
          autoComplete="new-password"
          value={confirmation}
          onChange={(evenement) => setConfirmation(evenement.target.value)}
          erreur={erreurConfirmation}
        />

        <BoutonPrincipal type="submit" enCours={enCours}>
          {enCours ? t('invitation.boutonEnCours') : t('invitation.bouton')}
        </BoutonPrincipal>
      </form>
    </CadreAuthentification>
  )
}