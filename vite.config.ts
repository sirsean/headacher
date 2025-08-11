import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite';

import { cloudflare } from "@cloudflare/vite-plugin";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), cloudflare(), tailwindcss()],
  // Ensure SPA fallback in dev and proxy /api to your backend (adjust target as needed)
//  appType: 'spa',
//  server: {
//    proxy: {
//      // Change the target to wherever your API runs in development
//      '/api': {
//        target: 'http://localhost:8787',
//        changeOrigin: true,
//        // Do not rewrite the path so /api/... is preserved by the backend
//        // If your backend does not expect the /api prefix, uncomment the next line
//        // rewrite: (path) => path.replace(/^\/api/, ''),
//      },
//    },
//  },
})
