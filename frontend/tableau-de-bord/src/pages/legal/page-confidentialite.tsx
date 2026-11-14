import { Link } from 'react-router'
import { CadrePageLegale } from '../../composants-communs/cadre-page-legale'
import { utiliserLangue } from '../../hooks/utiliser-langue'
import { COORDONNEES } from '../../utilitaires/coordonnees'

// Politique de confidentialite (page publique, route /confidentialite).
// Elle decrit ce que la plateforme enregistre vraiment : comptes des responsables, avis des
// clients (coordonnees facultatives, avec consentement), cookies techniques et journal des
// actions sensibles. Les textes sont dans traductions/fr/textes.ts et en/textes.ts,
// sous la cle "confidentialite".
export function PageConfidentialite() {
  const { t } = utiliserLangue()

  return (
    <CadrePageLegale titre={t('confidentialite.titre')}>
      <p>{t('confidentialite.intro')}</p>

      <section className="page-legale-section">
        <h2 className="page-legale-sous-titre">{t('confidentialite.responsableTitre')}</h2>
        <p>{t('confidentialite.responsableTexte', { nom: COORDONNEES.nomLegal })}</p>
      </section>

      <section className="page-legale-section">
        <h2 className="page-legale-sous-titre">{t('confidentialite.comptesTitre')}</h2>
        <p>{t('confidentialite.comptesTexte')}</p>
        <p>{t('confidentialite.motDePasseTexte')}</p>
        <p>{t('confidentialite.journalTexte')}</p>
      </section>

      <section className="page-legale-section">
        <h2 className="page-legale-sous-titre">{t('confidentialite.avisTitre')}</h2>
        <p>{t('confidentialite.avisTexte')}</p>
        <p>{t('confidentialite.avisContactTexte')}</p>
      </section>

      <section className="page-legale-section">
        <h2 className="page-legale-sous-titre">{t('confidentialite.cookiesTitre')}</h2>
        <p>{t('confidentialite.cookiesIntro')}</p>
        <ul className="page-legale-puces">
          <li>{t('confidentialite.cookieSession')}</li>
          <li>{t('confidentialite.cookieAppareil')}</li>
        </ul>
      </section>

      <section className="page-legale-section">
        <h2 className="page-legale-sous-titre">{t('confidentialite.droitsTitre')}</h2>
        <p>
          {t('confidentialite.droitsTexte')}{' '}
          <Link to="/mentions-legales">{t('confidentialite.droitsLien')}</Link>
        </p>
      </section>
    </CadrePageLegale>
  )
}