import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import App from './App'
import { FournisseurLangue } from './traductions/fournisseur-langue'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <FournisseurLangue>
        <App />
      </FournisseurLangue>
    </BrowserRouter>
  </StrictMode>,
)