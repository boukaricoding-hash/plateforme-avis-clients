import { Navigate, Outlet, useLocation } from 'react-router'
import { utiliserLangue } from '../hooks/utiliser-langue'
import { utiliserUtilisateur } from '../hooks/utiliser-utilisateur'

// Entoure tous les ecrans reserves aux utilisateurs connectes.
export function CadreProtege() {
  const { utilisateur, verification } = utiliserUtilisateur()
  const { t } = utiliserLangue()
  const emplacement = useLocation()

  // Verification de la session au demarrage (GET /auth/me).
  if (verification) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-fond text-texte-secondaire">
        <p role="status">{t('commun.chargement')}</p>
      </div>
    )
  }

  // Personne n'est connecte : connexion, en retenant la page demandee pour y revenir ensuite.
  if (utilisateur === null) {
    return <Navigate to="/connexion" replace state={{ depuis: emplacement.pathname }} />
  }

  return <Outlet />
}