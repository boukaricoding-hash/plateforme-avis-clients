import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { BoutonPrincipal } from '../../composants-communs/bouton-principal'
import { CadreAuthentification } from '../../composants-communs/cadre-authentification'
import { ChampTexte } from '../../composants-communs/champ-texte'
import { utiliserLangue } from '../../hooks/utiliser-langue'
import { ErreurService, reinitialiserMotDePasse } from '../../services/api'

const LONGUEUR_MINIMALE = 8

const CLASSE_LIEN =
  'inline-flex min-h-11 items-center text-sm font-medium text-principale underline hover:text-principale-fonce'

export function PageReinitialisation() {
  const { t } = utiliserLangue()
  const [parametres] = useSearchParams()
  const jeton = parametres.get('jeton') ?? ''

  const [motDePasse, setMotDePasse] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [erreurMotDePasse, setErreurMotDePasse] = useState('')
  const [erreurConfirmation, setErreurConfirmation] = useState('')
  const [erreurGenerale, setErreurGenerale] = useState('')
  const [lienInvalide, setLienInvalide] = useState(jeton === '')
  const [enCours, setEnCours] = useState(false)
  const [termine, setTermine] = useState(false)

  async function surEnvoi(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault()
    setErreurMotDePasse('')
    setErreurConfirmation('')
    setErreurGenerale('')

    if (motDePasse.length < LONGUEUR_MINIMALE) {
      setErreurMotDePasse(t('reinitialisation.erreurCourt'))
      return
    }
    if (motDePasse !== confirmation) {
      setErreurConfirmation(t('reinitialisation.erreurDifferents'))
      return
    }

    setEnCours(true)
    try {
      await reinitialiserMotDePasse(jeton, motDePasse)
      setTermine(true)
    } catch (erreur) {
      if (erreur instanceof ErreurService && erreur.code === 'LIEN_INVALIDE') {
        setLienInvalide(true)
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

  // Lien absent, invalide, deja utilise ou expire.
  if (lienInvalide) {
    return (
      <CadreAuthentification titre={t('reinitialisation.titre')}>
        <p
          role="alert"
          className="rounded-md border border-erreur bg-surface px-3 py-2 text-sm text-erreur"
        >
          {t('reinitialisation.erreurLienInvalide')}
        </p>
        <p className="mt-6 text-center">
          <Link to="/mot-de-passe-oublie" className={CLASSE_LIEN}>
            {t('reinitialisation.demanderNouveauLien')}
          </Link>
        </p>
      </CadreAuthentification>
    )
  }

  // Mot de passe modifie.
  if (termine) {
    return (
      <CadreAuthentification titre={t('reinitialisation.titre')}>
        <p
          role="status"
          className="rounded-md border border-succes bg-surface px-3 py-2 text-sm text-succes"
        >
          {t('reinitialisation.succes')}
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
      titre={t('reinitialisation.titre')}
      sousTitre={t('reinitialisation.explication')}
    >
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
          etiquette={t('reinitialisation.nouveau')}
          type="password"
          name="nouveau_mot_de_passe"
          autoComplete="new-password"
          value={motDePasse}
          onChange={(evenement) => setMotDePasse(evenement.target.value)}
          erreur={erreurMotDePasse}
        />

        <ChampTexte
          etiquette={t('reinitialisation.confirmation')}
          type="password"
          name="confirmation_mot_de_passe"
          autoComplete="new-password"
          value={confirmation}
          onChange={(evenement) => setConfirmation(evenement.target.value)}
          erreur={erreurConfirmation}
        />

        <BoutonPrincipal type="submit" enCours={enCours}>
          {enCours ? t('reinitialisation.boutonEnCours') : t('reinitialisation.bouton')}
        </BoutonPrincipal>
      </form>

      <p className="mt-6 text-center">
        <Link to="/connexion" className={CLASSE_LIEN}>
          {t('commun.retourConnexion')}
        </Link>
      </p>
    </CadreAuthentification>
  )
}