import { useEffect, useRef, useState } from 'react'
import { utiliserLangue } from '../../hooks/utiliser-langue'
import type { Brouillon } from '../../brouillon-hors-connexion/brouillon'

// Meme regle que le backend pour le telephone.
const FORME_TELEPHONE = /^[+0-9 ()-]{6,30}$/
const FORME_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Proprietes = {
  // Les saisies vivent dans le brouillon du parent : elles sont gardees sur le telephone.
  brouillon: Brouillon
  changer: (partiel: Partial<Brouillon>) => void
  // Touche Envoyer, une fois les champs verifies.
  envoyer: () => void
  retour: () => void
  envoiEnCours: boolean
  // Message sous le bouton : pas de reseau (le brouillon est garde) ou envoi refuse.
  message: 'hors_connexion' | 'echec' | null
}

// Ecran E3 : commentaire libre, coordonnees facultatives avec consentement, bouton Envoyer.
export function EcranCommentaire({
  brouillon,
  changer,
  envoyer,
  retour,
  envoiEnCours,
  message,
}: Proprietes) {
  const { t } = utiliserLangue()
  const [afficherErreurs, setAfficherErreurs] = useState(false)
  const [confidentialiteOuverte, setConfidentialiteOuverte] = useState(false)
  const titreRef = useRef<HTMLHeadingElement>(null)

  // A l'arrivee : en haut de la page et focus sur le titre (lecteurs d'ecran).
  useEffect(() => {
    window.scrollTo(0, 0)
    titreRef.current?.focus()
  }, [])

  const nom = brouillon.contact_nom.trim()
  const telephone = brouillon.contact_tel.trim()
  const email = brouillon.contact_email.trim()

  const telephoneInvalide = telephone !== '' && !FORME_TELEPHONE.test(telephone)
  const emailInvalide = email !== '' && !FORME_EMAIL.test(email)
  const contactRempli = nom !== '' || telephone !== '' || email !== ''
  // Des coordonnees sans consentement ne seraient pas enregistrees : on le dit au client.
  const consentementManquant = contactRempli && !brouillon.consentement
  const aDesErreurs = telephoneInvalide || emailInvalide || consentementManquant

  function validerEtEnvoyer() {
    if (aDesErreurs) {
      setAfficherErreurs(true)
      return
    }
    envoyer()
  }

  const classeChamp =
    'h-12 w-full rounded-xl border-2 border-slate-300 bg-white px-4 text-base text-slate-900 outline-none focus:border-[var(--couleur-principale)]'

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col gap-6 px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-6">
      <h1
        ref={titreRef}
        tabIndex={-1}
        className="text-2xl font-bold text-slate-900 outline-none"
      >
        {t('envoi.titre')}
      </h1>

      <div className="flex flex-col gap-2">
        <label htmlFor="champ-commentaire" className="text-base font-semibold text-slate-800">
          {t('envoi.commentaire')}
        </label>
        <textarea
          id="champ-commentaire"
          rows={4}
          maxLength={2000}
          value={brouillon.commentaire}
          onChange={(evenement) => changer({ commentaire: evenement.target.value })}
          placeholder={t('envoi.placeholderCommentaire')}
          className="w-full rounded-xl border-2 border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none focus:border-[var(--couleur-principale)]"
        />
      </div>

      <section className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-slate-900">{t('envoi.contactTitre')}</h2>
          <p className="text-sm text-slate-600">{t('envoi.contactAide')}</p>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="champ-nom" className="text-base text-slate-800">
            {t('envoi.nom')}
          </label>
          <input
            id="champ-nom"
            type="text"
            autoComplete="name"
            maxLength={100}
            value={brouillon.contact_nom}
            onChange={(evenement) => changer({ contact_nom: evenement.target.value })}
            className={classeChamp}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="champ-telephone" className="text-base text-slate-800">
            {t('envoi.telephone')}
          </label>
          <input
            id="champ-telephone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            maxLength={30}
            value={brouillon.contact_tel}
            onChange={(evenement) => changer({ contact_tel: evenement.target.value })}
            aria-invalid={afficherErreurs && telephoneInvalide}
            className={classeChamp}
          />
          {afficherErreurs && telephoneInvalide ? (
            <p role="alert" className="text-sm font-medium text-red-600">
              {t('envoi.telephoneInvalide')}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="champ-email" className="text-base text-slate-800">
            {t('envoi.email')}
          </label>
          <input
            id="champ-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            maxLength={200}
            value={brouillon.contact_email}
            onChange={(evenement) => changer({ contact_email: evenement.target.value })}
            aria-invalid={afficherErreurs && emailInvalide}
            className={classeChamp}
          />
          {afficherErreurs && emailInvalide ? (
            <p role="alert" className="text-sm font-medium text-red-600">
              {t('envoi.emailInvalide')}
            </p>
          ) : null}
        </div>

        <label className="flex items-start gap-3 text-base text-slate-800">
          <input
            type="checkbox"
            checked={brouillon.consentement}
            onChange={(evenement) => changer({ consentement: evenement.target.checked })}
            className="mt-0.5 h-6 w-6 shrink-0 accent-[var(--couleur-principale)]"
          />
          <span>{t('envoi.consentement')}</span>
        </label>
        {afficherErreurs && consentementManquant ? (
          <p role="alert" className="text-sm font-medium text-red-600">
            {t('envoi.consentementRequis')}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => setConfidentialiteOuverte(true)}
          className="self-start text-sm text-slate-600 underline"
        >
          {t('envoi.confidentialiteLien')}
        </button>
      </section>

      {message === 'hors_connexion' ? (
        <p role="status" className="rounded-xl bg-amber-50 px-4 py-3 text-base text-amber-900">
          {t('envoi.horsConnexion')}
        </p>
      ) : null}
      {message === 'echec' ? (
        <p role="alert" className="text-base font-medium text-red-600">
          {t('envoi.erreurEnvoi')}
        </p>
      ) : null}

      <div className="mt-auto grid grid-cols-2 gap-3 pt-4">
        <button
          type="button"
          onClick={retour}
          disabled={envoiEnCours}
          className="flex h-14 items-center justify-center rounded-xl border-2 border-slate-300 bg-white text-lg font-semibold text-slate-700 active:opacity-90 disabled:opacity-50"
        >
          {t('question.retour')}
        </button>
        <button
          type="button"
          onClick={validerEtEnvoyer}
          disabled={envoiEnCours}
          className="flex h-14 items-center justify-center rounded-xl bg-[var(--couleur-principale)] text-lg font-semibold text-white shadow-sm active:opacity-90 disabled:opacity-60"
        >
          {envoiEnCours ? t('envoi.envoiEnCours') : t('envoi.envoyer')}
        </button>
      </div>

      {confidentialiteOuverte ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="titre-confidentialite"
          className="fixed inset-0 z-10 flex items-end bg-black/40"
        >
          <div className="mx-auto flex w-full max-w-md flex-col gap-4 rounded-t-2xl bg-white p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <h2 id="titre-confidentialite" className="text-xl font-bold text-slate-900">
              {t('envoi.confidentialiteTitre')}
            </h2>
            <p className="text-base text-slate-700">{t('envoi.confidentialiteTexte')}</p>
            <button
              type="button"
              onClick={() => setConfidentialiteOuverte(false)}
              className="flex h-12 items-center justify-center rounded-xl bg-[var(--couleur-principale)] text-lg font-semibold text-white"
            >
              {t('envoi.fermer')}
            </button>
          </div>
        </div>
      ) : null}
    </main>
  )
}