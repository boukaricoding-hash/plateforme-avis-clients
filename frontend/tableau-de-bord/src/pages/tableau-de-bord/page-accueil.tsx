import { utiliserLangue } from '../../hooks/utiliser-langue'
import { utiliserUtilisateur } from '../../hooks/utiliser-utilisateur'

// Accueil provisoire : les indicateurs et les graphiques (ecran E7) arrivent au jour 14.
export function PageAccueil() {
  const { t } = utiliserLangue()
  const { utilisateur } = utiliserUtilisateur()

  return (
    <div>
      <h1 className="font-titre text-2xl font-bold text-texte">{t('accueil.titre')}</h1>
      {utilisateur !== null && (
        <p className="mt-1 text-texte-secondaire">
          {t('accueil.bonjour', { nom: utilisateur.nom })}
        </p>
      )}
    </div>
  )
}