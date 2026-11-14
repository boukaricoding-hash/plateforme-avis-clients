import { Link } from 'react-router'
import { utiliserLangue } from '../hooks/utiliser-langue'
import { lienEmail, lienWhatsapp } from '../utilitaires/coordonnees'

// Pied de page des ecrans accessibles sans etre connecte : copyright, mentions legales,
// confidentialite et contact. Les deux pages legales sont publiques (routes dans App.tsx).
// Le lien "Contact" ouvre l'e-mail, ou WhatsApp s'il n'y a pas d'adresse e-mail ;
// sans aucune coordonnee dans utilitaires/coordonnees.ts, il n'est pas affiche.
// Les textes sont dans traductions/fr/textes.ts et en/textes.ts, sous la cle "pied".
// Les styles sont dans styles/connexion.css.
type Proprietes = {
  // Nom de l'entreprise ecrit apres le (c)
  nom: string
}

export function PiedDePageConfiance({ nom }: Proprietes) {
  const { t } = utiliserLangue()

  const email = lienEmail('', '')
  const whatsapp = lienWhatsapp('')
  const lienContact = email ?? whatsapp

  return (
    <footer className="connexion-pied">
      <p className="connexion-pied-copyright">
        © {new Date().getFullYear()} {nom}
      </p>

      <nav className="connexion-pied-liens" aria-label={t('pied.navigation')}>
        <Link to="/mentions-legales">{t('pied.mentionsLegales')}</Link>
        <Link to="/confidentialite">{t('pied.confidentialite')}</Link>
        {lienContact !== null && (
          <a
            href={lienContact}
            {...(email === null ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          >
            {t('pied.contact')}
          </a>
        )}
      </nav>
    </footer>
  )
}