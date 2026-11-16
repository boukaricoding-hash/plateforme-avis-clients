import { Link } from 'react-router'
import { CadrePageLegale } from '../../composants-communs/cadre-page-legale'
import { utiliserLangue } from '../../hooks/utiliser-langue'
import { COORDONNEES } from '../../utilitaires/coordonnees'

// Mentions legales (page publique, route /mentions-legales).
// Les informations viennent de utilitaires/coordonnees.ts : une valeur vide n'est pas affichee.
// Les textes sont dans traductions/fr/textes.ts et en/textes.ts, sous la cle "mentions".
export function PageMentionsLegales() {
  const { t } = utiliserLangue()

  // Les lignes de la fiche "Editeur du site" ; on garde seulement celles qui sont renseignees.
  const infosEditeur = [
    { libelle: t('mentions.libelleEditeur'), valeur: COORDONNEES.nomLegal },
    { libelle: t('mentions.libelleResponsable'), valeur: COORDONNEES.responsable },
    { libelle: t('mentions.libelleAdresse'), valeur: COORDONNEES.adresse },
    { libelle: t('mentions.libelleEmail'), valeur: COORDONNEES.email },
    { libelle: t('mentions.libelleWhatsapp'), valeur: COORDONNEES.whatsapp },
  ].filter((info) => info.valeur.trim() !== '')

  return (
    <CadrePageLegale titre={t('mentions.titre')}>
      <p>{t('mentions.intro')}</p>

      <section className="page-legale-section">
        <h2 className="page-legale-sous-titre">{t('mentions.editeurTitre')}</h2>
        <dl className="page-legale-liste">
          {infosEditeur.map((info) => (
            <div key={info.libelle} className="page-legale-ligne">
              <dt>{info.libelle}</dt>
              <dd>{info.valeur}</dd>
            </div>
          ))}
        </dl>
      </section>

      {COORDONNEES.hebergeur.trim() !== '' && (
        <section className="page-legale-section">
          <h2 className="page-legale-sous-titre">{t('mentions.hebergementTitre')}</h2>
          <p>{t('mentions.hebergementTexte', { nom: COORDONNEES.hebergeur })}</p>
        </section>
      )}

      <section className="page-legale-section">
        <h2 className="page-legale-sous-titre">{t('mentions.proprieteTitre')}</h2>
        <p>{t('mentions.proprieteTexte', { nom: COORDONNEES.nomLegal })}</p>
      </section>

      <section className="page-legale-section">
        <h2 className="page-legale-sous-titre">{t('mentions.responsabiliteTitre')}</h2>
        <p>{t('mentions.responsabiliteTexte', { nom: COORDONNEES.nomLegal })}</p>
      </section>

      <section className="page-legale-section">
        <h2 className="page-legale-sous-titre">{t('mentions.donneesTitre')}</h2>
        <p>
          {t('mentions.donneesTexte')}{' '}
          <Link to="/confidentialite">{t('mentions.donneesLien')}</Link>
        </p>
      </section>
    </CadrePageLegale>
  )
}