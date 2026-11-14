import { Navigate, Route, Routes } from 'react-router'
import { utiliserLangue } from './hooks/utiliser-langue'
import { CadreApplication } from './mise-en-page/cadre-application'
import { CadreProtege } from './mise-en-page/cadre-protege'
import { PageModelesSectoriels } from './pages/administration/modeles-sectoriels/page-modeles-sectoriels'
import { PageOrganisations } from './pages/administration/organisations/page-organisations'
import { PageConnexion } from './pages/connexion/page-connexion'
import { PageAccepterInvitation } from './pages/invitation/page-accepter-invitation'
import { PageMotDePasseOublie } from './pages/connexion/page-mot-de-passe-oublie'
import { PageReinitialisation } from './pages/connexion/page-reinitialisation'
import { PageListeAvis } from './pages/liste-avis/page-liste-avis'
import { PageParametres } from './pages/parametres-organisation/page-parametres'
import { PageQrCodes } from './pages/qr-codes/page-qr-codes'
import { PageEditeurQuestionnaire } from './pages/questionnaires/page-editeur-questionnaire'
import { PageQuestionnaires } from './pages/questionnaires/page-questionnaires'
import { PageExports } from './pages/rapports-exports/page-exports'
import { PageSites } from './pages/sites-points-de-contact/page-sites'
import { PageAccueil } from './pages/tableau-de-bord/page-accueil'
import { PageUtilisateurs } from './pages/utilisateurs/page-utilisateurs'

// Ecrans prevus mais pas encore construits : chacun est remplace par son vrai ecran le jour venu.
// La liste est vide depuis le jour 21 (l'ecran des exports est en place).
const ECRANS_A_VENIR: { chemin: string; cle: string }[] = []

function EcranAVenir({ cle }: { cle: string }) {
  const { t } = utiliserLangue()
  return (
    <div>
      <h1 className="font-titre text-2xl font-bold text-texte">{t(cle)}</h1>
      <p className="mt-1 text-texte-secondaire">{t('commun.enConstruction')}</p>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      {/* Ecrans accessibles sans etre connecte */}
      <Route path="/connexion" element={<PageConnexion />} />
      <Route path="/mot-de-passe-oublie" element={<PageMotDePasseOublie />} />
      <Route path="/reinitialiser-mot-de-passe" element={<PageReinitialisation />} />
      <Route path="/invitation" element={<PageAccepterInvitation />} />

      {/* Ecrans reserves aux utilisateurs connectes */}
      <Route element={<CadreProtege />}>
        <Route element={<CadreApplication />}>
          <Route index element={<PageAccueil />} />
          <Route path="avis" element={<PageListeAvis />} />
          <Route path="avis/:id" element={<PageListeAvis />} />
          <Route path="parametres" element={<PageParametres />} />
          <Route path="sites" element={<PageSites />} />
          <Route path="qr-codes" element={<PageQrCodes />} />
          <Route path="questionnaires" element={<PageQuestionnaires />} />
          <Route path="questionnaires/:id" element={<PageEditeurQuestionnaire />} />
          <Route path="utilisateurs" element={<PageUtilisateurs />} />
          <Route path="exports" element={<PageExports />} />
          <Route path="admin/organisations" element={<PageOrganisations />} />
          <Route path="admin/secteurs" element={<PageModelesSectoriels />} />
          {ECRANS_A_VENIR.map((ecran) => (
            <Route
              key={ecran.chemin}
              path={ecran.chemin}
              element={<EcranAVenir cle={ecran.cle} />}
            />
          ))}
        </Route>
      </Route>

      {/* Adresse inconnue : retour a l'accueil */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}