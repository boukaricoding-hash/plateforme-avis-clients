import { Navigate, Outlet, useLocation } from 'react-router'
import { ChargementBattement } from '../composants-communs/chargement-battement'
import { utiliserDureeMinimale } from '../hooks/utiliser-duree-minimale'
import { utiliserUtilisateur } from '../hooks/utiliser-utilisateur'

// Entoure tous les ecrans reserves aux utilisateurs connectes.
export function CadreProtege() {
  const { utilisateur, verification } = utiliserUtilisateur()
  const emplacement = useLocation()

  // Verification de la session au demarrage (GET /auth/me).
  // Le loader (battement de coeur puis lettre D) reste au moins 2,5 s au premier affichage,
  // meme si la session est verifiee plus vite. Apres la connexion, il ne rejoue pas.
  const phase = utiliserDureeMinimale(!verification)
  if (phase !== 'termine') {
    return <ChargementBattement sortie={phase === 'sortie'} />
  }

  // Personne n'est connecte : connexion, en retenant la page demandee pour y revenir ensuite.
  if (utilisateur === null) {
    return <Navigate to="/connexion" replace state={{ depuis: emplacement.pathname }} />
  }

  return <Outlet />
}