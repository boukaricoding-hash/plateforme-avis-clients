import { Navigate, Route, Routes } from 'react-router'
import { utiliserLangue } from './hooks/utiliser-langue'
import { CadreApplication } from './mise-en-page/cadre-application'
import { CadreProtege } from './mise-en-page/cadre-protege'
import { PageConnexion } from './pages/connexion/page-connexion'
import { PageMotDePasseOublie } from './pages/connexion/page-mot-de-passe-oublie'
import { PageReinitialisation } from './pages/connexion/page-reinitialisation'
import { PageAccueil } from './pages/tableau-de-bord/page-accueil'

// Ecrans prevus mais pas encore construits : chacun est remplace par son vrai ecran le jour venu.
const ECRANS_A_VENIR = [
  { chemin: 'avis', cle: 'menu.avis' },
  { chemin: 'questionnaires', cle: 'menu.questionnaires' },
  { chemin: 'qr-codes', cle: 'menu.qrCodes' },
  { chemin: 'sites', cle: 'menu.sites' },
  { chemin: 'utilisateurs', cle: 'menu.utilisateurs' },
  { chemin: 'exports', cle: 'menu.exports' },
  { chemin: 'parametres', cle: 'menu.parametres' },
]

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

      {/* Ecrans reserves aux utilisateurs connectes */}
      <Route element={<CadreProtege />}>
        <Route element={<CadreApplication />}>
          <Route index element={<PageAccueil />} />
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