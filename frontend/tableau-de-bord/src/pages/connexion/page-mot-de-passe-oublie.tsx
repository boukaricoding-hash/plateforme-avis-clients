import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router'
import { BoutonPrincipal } from '../../composants-communs/bouton-principal'
import { CadreAuthentification } from '../../composants-communs/cadre-authentification'
import { ChampTexte } from '../../composants-communs/champ-texte'
import { utiliserLangue } from '../../hooks/utiliser-langue'
import { ErreurService, demanderReinitialisation } from '../../services/api'

const MOTIF_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Duree de validite du lien (identique cote backend : 30 minutes).
const MINUTES_VALIDITE = 30

export function PageMotDePasseOublie() {
  const { t } = utiliserLangue()

  const [email, setEmail] = useState('')
  const [erreurEmail, setErreurEmail] = useState('')
  const [erreurGenerale, setErreurGenerale] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [envoye, setEnvoye] = useState(false)

  async function surEnvoi(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault()
    setErreurEmail('')
    setErreurGenerale('')

    const emailNettoye = email.trim()
    if (!MOTIF_EMAIL.test(emailNettoye)) {
      setErreurEmail(t('connexion.erreurEmailInvalide'))
      return
    }

    setEnCours(true)
    try {
      await demanderReinitialisation(emailNettoye)
      setEnvoye(true)
    } catch (erreur) {
      if (erreur instanceof ErreurService && erreur.statut === 429) {
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

  return (
    <CadreAuthentification
      titre={t('motDePasseOublie.titre')}
      sousTitre={envoye ? undefined : t('motDePasseOublie.explication')}
    >
      {envoye ? (
        <p
          role="status"
          className="rounded-md border border-succes bg-surface px-3 py-2 text-sm text-succes"
        >
          {t('motDePasseOublie.confirmation', { minutes: MINUTES_VALIDITE })}
        </p>
      ) : (
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
            autoComplete="email"
            placeholder={t('connexion.emailPlaceholder')}
            value={email}
            onChange={(evenement) => setEmail(evenement.target.value)}
            erreur={erreurEmail}
          />

          <BoutonPrincipal type="submit" enCours={enCours}>
            {enCours ? t('motDePasseOublie.boutonEnCours') : t('motDePasseOublie.bouton')}
          </BoutonPrincipal>
        </form>
      )}

      <p className="mt-6 text-center">
        <Link
          to="/connexion"
          className="inline-flex min-h-11 items-center text-sm font-medium text-principale underline hover:text-principale-fonce"
        >
          {t('commun.retourConnexion')}
        </Link>
      </p>
    </CadreAuthentification>
  )
}