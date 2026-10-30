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

// Meme fond que les autres ecrans : peche tres clair en haut, beige, puis beige rose en bas.
const FOND_COMMENTAIRE =
  'linear-gradient(170deg, color-mix(in srgb, var(--couleur-decor-clair) 40%, var(--fond-alt)) 0%, var(--fond) 35%, var(--fond-alt) 62%, var(--surface-douce) 100%)'

// Mouvements du fond (les noms commencent par commentaire-).
const STYLES = `
@keyframes commentaire-lumiere {
  from { background-position: 0% 0%; }
  to { background-position: 0% 100%; }
}
@keyframes commentaire-vague {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}

.commentaire-fond {
  background-size: 100% 220%;
  animation: commentaire-lumiere 30s ease-in-out infinite alternate;
}
.commentaire-vague-1 {
  animation: commentaire-vague 26s linear infinite;
}
.commentaire-vague-2 {
  animation: commentaire-vague 17s linear infinite reverse;
}

@media (prefers-reduced-motion: reduce) {
  .commentaire-fond,
  .commentaire-vague-1,
  .commentaire-vague-2 {
    animation: none;
  }
}
`

// Une vague : le dessin se repete deux fois (800 de large, periode 400).
const VAGUE = 'M0 50 C 100 10, 300 90, 400 50 C 500 10, 700 90, 800 50 L800 100 L0 100 Z'

// Decor : meme style que l'accueil et les questions (degrade qui glisse, trame de points fins,
// deux vagues basses). Purement decoratif : cache aux lecteurs d'ecran et sans effet sur les clics.
function DecorCommentaire() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      <style>{STYLES}</style>

      <div
        className="commentaire-fond absolute inset-0"
        style={{ background: FOND_COMMENTAIRE, backgroundSize: '100% 220%' }}
      />

      <svg
        className="absolute inset-0 h-full w-full"
        style={{
          opacity: 0.07,
          WebkitMaskImage: 'linear-gradient(180deg, #000 0%, transparent 70%)',
          maskImage: 'linear-gradient(180deg, #000 0%, transparent 70%)',
        }}
      >
        <defs>
          <pattern id="commentaire-points" width="22" height="22" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.2" style={{ fill: 'var(--texte)' }} />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#commentaire-points)" />
      </svg>

      <div className="commentaire-vague-1 absolute bottom-0 left-0 h-28 w-[200%]">
        <svg viewBox="0 0 800 100" preserveAspectRatio="none" className="h-full w-full">
          <path d={VAGUE} style={{ fill: 'var(--surface-douce)', fillOpacity: 0.9 }} />
        </svg>
      </div>
      <div className="commentaire-vague-2 absolute bottom-0 left-0 h-20 w-[200%]">
        <svg viewBox="0 0 800 100" preserveAspectRatio="none" className="h-full w-full">
          <path d={VAGUE} style={{ fill: 'var(--couleur-decor-clair)', fillOpacity: 0.4 }} />
        </svg>
      </div>
    </div>
  )
}

// Champ a la ligne : pas de cadre, seulement un trait fin en bas.
// Au focus le trait prend la couleur principale et s'epaissit sans decaler la page.
// Un champ invalide (aria-invalid) passe le trait en rouge.
const CLASSE_LIGNE =
  'w-full border-b border-bordure-champ bg-transparent px-0 text-base text-texte outline-none transition-colors placeholder:text-texte-discret focus:border-principale focus:shadow-[0_1px_0_0_var(--couleur-principale)] aria-[invalid=true]:border-erreur aria-[invalid=true]:shadow-[0_1px_0_0_var(--erreur)]'

const CLASSE_ETIQUETTE = 'text-sm font-medium text-texte-secondaire'

// Ecran E3 : commentaire libre, coordonnees facultatives avec consentement, bouton Envoyer.
// Tout est pose directement sur la page : pas de cadres, des champs a la ligne.
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

  return (
    <div className="relative isolate min-h-svh w-full overflow-hidden">
      <DecorCommentaire />

      <main className="relative mx-auto flex min-h-svh w-full max-w-md flex-col gap-8 px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
        <h1
          ref={titreRef}
          tabIndex={-1}
          className="font-titre text-3xl font-semibold leading-snug text-texte outline-none"
        >
          {t('envoi.titre')}
        </h1>

        {/* Commentaire : une zone a la ligne, sans cadre. */}
        <div className="flex flex-col gap-1">
          <label htmlFor="champ-commentaire" className={CLASSE_ETIQUETTE}>
            {t('envoi.commentaire')}
          </label>
          <textarea
            id="champ-commentaire"
            rows={3}
            maxLength={2000}
            value={brouillon.commentaire}
            onChange={(evenement) => changer({ commentaire: evenement.target.value })}
            placeholder={t('envoi.placeholderCommentaire')}
            // text-base (16 px) evite le zoom automatique sur iPhone a la selection du champ.
            className={CLASSE_LIGNE + ' min-h-24 resize-none py-2 leading-relaxed'}
          />
        </div>

        {/* Coordonnees : pas de carte, juste un trait fin au-dessus pour separer. */}
        <section className="flex flex-col gap-6 border-t border-bordure pt-6">
          <div className="flex flex-col gap-1">
            <h2 className="font-titre text-xl font-semibold text-texte">
              {t('envoi.contactTitre')}
            </h2>
            <p className="text-sm text-texte-secondaire">{t('envoi.contactAide')}</p>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="champ-nom" className={CLASSE_ETIQUETTE}>
              {t('envoi.nom')}
            </label>
            <input
              id="champ-nom"
              type="text"
              autoComplete="name"
              maxLength={100}
              value={brouillon.contact_nom}
              onChange={(evenement) => changer({ contact_nom: evenement.target.value })}
              className={CLASSE_LIGNE + ' h-11'}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="champ-telephone" className={CLASSE_ETIQUETTE}>
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
              className={CLASSE_LIGNE + ' h-11'}
            />
            {afficherErreurs && telephoneInvalide ? (
              <p role="alert" className="text-sm font-medium text-erreur">
                {t('envoi.telephoneInvalide')}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="champ-email" className={CLASSE_ETIQUETTE}>
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
              className={CLASSE_LIGNE + ' h-11'}
            />
            {afficherErreurs && emailInvalide ? (
              <p role="alert" className="text-sm font-medium text-erreur">
                {t('envoi.emailInvalide')}
              </p>
            ) : null}
          </div>

          <label className="flex items-start gap-3 text-base text-texte">
            <input
              type="checkbox"
              checked={brouillon.consentement}
              onChange={(evenement) => changer({ consentement: evenement.target.checked })}
              className="mt-0.5 h-5 w-5 shrink-0 accent-principale"
            />
            <span>{t('envoi.consentement')}</span>
          </label>
          {afficherErreurs && consentementManquant ? (
            <p role="alert" className="-mt-3 text-sm font-medium text-erreur">
              {t('envoi.consentementRequis')}
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => setConfidentialiteOuverte(true)}
            className="-mt-2 self-start text-sm text-texte-secondaire underline underline-offset-4 transition-colors hover:text-texte focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-principale"
          >
            {t('envoi.confidentialiteLien')}
          </button>
        </section>

        {message === 'hors_connexion' ? (
          <p
            role="status"
            className="border-l-2 border-alerte pl-3 text-base text-texte"
          >
            {t('envoi.horsConnexion')}
          </p>
        ) : null}
        {message === 'echec' ? (
          <p role="alert" className="text-base font-medium text-erreur">
            {t('envoi.erreurEnvoi')}
          </p>
        ) : null}

        <div className="mt-auto grid grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            onClick={retour}
            disabled={envoiEnCours}
            className="flex h-12 items-center justify-center rounded-[var(--rayon-sm)] border border-bordure-forte bg-transparent text-base font-semibold text-texte-secondaire transition hover:bg-surface/60 hover:text-texte active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-principale disabled:opacity-50"
          >
            {t('question.retour')}
          </button>
          <button
            type="button"
            onClick={validerEtEnvoyer}
            disabled={envoiEnCours}
            className="flex h-12 items-center justify-center rounded-[var(--rayon-sm)] bg-principale-fonce text-base font-semibold text-texte-sur-principale transition active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-principale disabled:opacity-60"
          >
            {envoiEnCours ? t('envoi.envoiEnCours') : t('envoi.envoyer')}
          </button>
        </div>

        {confidentialiteOuverte ? (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titre-confidentialite"
            className="fixed inset-0 z-10 flex items-end bg-texte/40"
          >
            <div className="mx-auto flex w-full max-w-md flex-col gap-4 rounded-t-[var(--rayon-xl)] bg-surface p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-fort">
              <h2
                id="titre-confidentialite"
                className="font-titre text-xl font-semibold text-texte"
              >
                {t('envoi.confidentialiteTitre')}
              </h2>
              <p className="text-base text-texte-secondaire">{t('envoi.confidentialiteTexte')}</p>
              <button
                type="button"
                onClick={() => setConfidentialiteOuverte(false)}
                className="flex h-12 items-center justify-center rounded-[var(--rayon-sm)] bg-principale-fonce text-base font-semibold text-texte-sur-principale transition active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-principale"
              >
                {t('envoi.fermer')}
              </button>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  )
}