import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './styles/index.css'
import App from './App'
import { FournisseurTheme } from './contextes/fournisseur-theme'
import { FournisseurLangue } from './traductions/fournisseur-langue'
import { FournisseurUtilisateur } from './contextes/fournisseur-utilisateur'
import { CadreDemarrage } from './mise-en-page/cadre-demarrage'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* basename : toutes les routes et tous les liens sont sous /tableau-de-bord */}
    <BrowserRouter basename="/tableau-de-bord">
      <FournisseurTheme>
        <FournisseurLangue>
          <FournisseurUtilisateur>
            {/* Le loader (battement de coeur puis lettre D) entoure toutes les pages */}
            <CadreDemarrage>
              <App />
            </CadreDemarrage>
          </FournisseurUtilisateur>
        </FournisseurLangue>
      </FournisseurTheme>
    </BrowserRouter>
  </StrictMode>,
)