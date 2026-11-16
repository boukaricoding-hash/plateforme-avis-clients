import { utiliserLangue } from '../hooks/utiliser-langue'
import { lienEmail, lienWhatsapp } from '../utilitaires/coordonnees'

// Bouton "Demander une demo" pour les personnes qui ne sont pas encore clientes.
// Il ouvre WhatsApp (message deja ecrit) et, si une adresse e-mail est aussi renseignee,
// propose un second lien "ou par e-mail". Les coordonnees viennent de utilitaires/coordonnees.ts :
// sans numero ni adresse, rien ne s'affiche.
// Les textes sont dans traductions/fr/textes.ts et en/textes.ts, sous la cle "contact".
// Les styles sont dans styles/connexion.css.
const ICONE_BULLE = 'M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z'
const ICONE_ENVELOPPE = 'M4 6h16v12H4zM4 7l8 6 8-6'

type Proprietes = {
  // "barre" : dans la barre du haut (ecran large). "accueil" : dans l'accueil telephone.
  emplacement: 'barre' | 'accueil'
}

export function BoutonContact({ emplacement }: Proprietes) {
  const { t } = utiliserLangue()

  const whatsapp = lienWhatsapp(t('contact.messageDemo'))
  const email = lienEmail(t('contact.sujetDemo'), t('contact.messageDemo'))

  // Aucun moyen de contact renseigne : on n'affiche rien.
  if (whatsapp === null && email === null) {
    return null
  }

  // Le lien principal est WhatsApp ; sans numero, c'est l'e-mail.
  const principal = whatsapp ?? email ?? ''
  const principalWhatsapp = whatsapp !== null
  // Le second lien n'existe que si les deux moyens sont renseignes.
  const secondaire = whatsapp !== null ? email : null

  return (
    <div className="connexion-contact" data-emplacement={emplacement}>
      <a
        className="connexion-bouton-contact"
        href={principal}
        {...(principalWhatsapp ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        aria-label={
          principalWhatsapp
            ? `${t('contact.demande')} (${t('contact.canalWhatsapp')})`
            : t('contact.demande')
        }
      >
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d={principalWhatsapp ? ICONE_BULLE : ICONE_ENVELOPPE} />
        </svg>
        {t('contact.demande')}
      </a>

      {secondaire !== null && (
        <a className="connexion-lien-contact" href={secondaire}>
          <svg
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d={ICONE_ENVELOPPE} />
          </svg>
          {t('contact.parEmail')}
        </a>
      )}
    </div>
  )
}