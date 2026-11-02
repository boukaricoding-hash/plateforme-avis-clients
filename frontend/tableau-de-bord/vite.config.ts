import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Le tableau de bord est servi sous /tableau-de-bord (meme adresse que la page d'avis).
  base: '/tableau-de-bord/',
  plugins: [react(), tailwindcss()],
  server: {
    // Accessible depuis le telephone ou une tablette (meme Wi-Fi) : http://IP_DU_PC:5174/tableau-de-bord/
    host: true,
    // 5173 est deja pris par la page d'avis du client
    port: 5174,
    strictPort: true,
    // Les appels /api/... sont transmis au backend : meme adresse, le cookie de session
    // passe sans probleme de CORS.
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})