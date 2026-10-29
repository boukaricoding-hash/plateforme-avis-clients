import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Accessible depuis le telephone (meme Wi-Fi) : http://IP_DU_PC:5173
    host: true,
    port: 5173,
    strictPort: true,
    // Les appels /api/... sont transmis au backend : meme adresse, pas de probleme de CORS.
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})