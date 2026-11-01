import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './styles/index.css'
import App from './App'
import { FournisseurLangue } from './traductions/fournisseur-langue'
import { FournisseurUtilisateur } from './contextes/fournisseur-utilisateur'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <FournisseurLangue>
        <FournisseurUtilisateur>
          <App />
        </FournisseurUtilisateur>
      </FournisseurLangue>
    </BrowserRouter>
  </StrictMode>,
)