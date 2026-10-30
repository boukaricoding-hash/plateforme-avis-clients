import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import App from './App'
import { FournisseurLangue } from './traductions/fournisseur-langue'

const racine = createRoot(document.getElementById('root')!)

if (import.meta.env.DEV && window.location.pathname === '/mascotte') {
  // Page de test de la mascotte : seulement pendant npm run dev, absente de la version compilee.
  void import('./pages/dev/page-mascotte').then(({ PageMascotte }) => {
    racine.render(
      <StrictMode>
        <PageMascotte />
      </StrictMode>,
    )
  })
} else {
  racine.render(
    <StrictMode>
      <BrowserRouter>
        <FournisseurLangue>
          <App />
        </FournisseurLangue>
      </BrowserRouter>
    </StrictMode>,
  )
}

// Service worker : seulement dans la version compilee (npm run build), jamais pendant
// npm run dev, sinon il garderait d'anciennes copies et brouillerait les essais.
// Il ne fonctionne qu'en HTTPS ou sur localhost : sur http://IP_DU_PC il reste inactif.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Sans service worker, la page fonctionne quand meme normalement.
    })
  })
}