import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router'
import { BoutonPrincipal } from '../../composants-communs/bouton-principal'
import { CadreAuthentification } from '../../composants-communs/cadre-authentification'
import { ChampTexte } from '../../composants-communs/champ-texte'
import { utiliserLangue } from '../../hooks/utiliser-langue'
import { utiliserUtilisateur } from '../../hooks/utiliser-utilisateur'
import { ErreurService } from '../../services/api'

const MOTIF_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Page a ouvrir apres la connexion : celle que l'utilisateur voulait, sinon l'accueil.
// On n'accepte qu'un chemin interne au site.
function destinationApresConnexion(etat: unknown): string {
  const depuis = (etat as { depuis?: unknown } | null)?.depuis
  if (
    typeof depuis === 'string' &&
    depuis.startsWith('/') &&
    !depuis.startsWith('//') &&
    !depuis.startsWith('/connexion')
  ) {
    return depuis
  }
  return '/'
}

export function PageConnexion() {
  const { t } = utiliserLangue()
  const { utilisateur, seConnecter } = utiliserUtilisateur()
  const emplacement = useLocation()

  const [email, setEmail] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [seSouvenir, setSeSouvenir] = useState(false)
  const [erreurEmail, setErreurEmail] = useState('')
  const [erreurGenerale, setErreurGenerale] = useState('')
  const [enCours, setEnCours] = useState(false)

  // Deja connecte (ou connexion reussie) : on quitte cet ecran.
  if (utilisateur !== null) {
    return <Navigate to={destinationApresConnexion(emplacement.state)} replace />
  }

  async function surEnvoi(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault()
    setErreurEmail('')
    setErreurGenerale('')

    const emailNettoye = email.trim()
    if (emailNettoye === '' || motDePasse === '') {
      setErreurGenerale(t('connexion.erreurChampsVides'))
      return
    }
    if (!MOTIF_EMAIL.test(emailNettoye)) {
      setErreurEmail(t('connexion.erreurEmailInvalide'))
      return
    }

    setEnCours(true)
    try {
      await seConnecter(emailNettoye, motDePasse, seSouvenir)
      // La redirection se fait toute seule : l'utilisateur est maintenant connecte.
    } catch (erreur) {
      if (erreur instanceof ErreurService) {
        if (erreur.statut === 401) {
          setErreurGenerale(t('connexion.erreurIdentifiants'))
        } else if (erreur.statut === 429) {
          setErreurGenerale(t('connexion.erreurTropDeTentatives'))
        } else if (erreur.statut === 0) {
          setErreurGenerale(t('commun.erreurReseau'))
        } else {
          setErreurGenerale(t('commun.erreurGenerique'))
        }
      } else {
        setErreurGenerale(t('commun.erreurGenerique'))
      }
      setEnCours(false)
    }
  }

  return (
    <CadreAuthentification titre={t('connexion.titre')} sousTitre={t('connexion.sousTitre')}>
      <form onSubmit={(evenement) => void surEnvoi(evenement)} noValidate className="flex flex-col gap-4">
        {erreurGenerale !== '' && (
          <p
            role="alert"
            className="rounded-md border border-erreur bg-surface px-3 py-2 text-sm text-erreur"
          >
            {erreurGenerale}
          </p>
        )}

        <ChampTexte
          etiquette={t('connexion.email')}
          type="email"
          name="email"
          autoComplete="username"
          placeholder={t('connexion.emailPlaceholder')}
          value={email}
          onChange={(evenement) => setEmail(evenement.target.value)}
          erreur={erreurEmail}
        />

        <ChampTexte
          etiquette={t('connexion.motDePasse')}
          type="password"
          name="mot_de_passe"
          autoComplete="current-password"
          value={motDePasse}
          onChange={(evenement) => setMotDePasse(evenement.target.value)}
        />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="flex min-h-11 items-center gap-2 text-sm text-texte">
            <input
              type="checkbox"
              checked={seSouvenir}
              onChange={(evenement) => setSeSouvenir(evenement.target.checked)}
              className="h-5 w-5 accent-principale"
            />
            {t('connexion.seSouvenir')}
          </label>

          <Link
            to="/mot-de-passe-oublie"
            className="flex min-h-11 items-center text-sm font-medium text-principale underline hover:text-principale-fonce"
          >
            {t('connexion.motDePasseOublie')}
          </Link>
        </div>

        <BoutonPrincipal type="submit" enCours={enCours}>
          {enCours ? t('connexion.boutonEnCours') : t('connexion.bouton')}
        </BoutonPrincipal>
      </form>
    </CadreAuthentification>
  )
}