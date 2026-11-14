// Build-Konfiguration. base: './' sorgt dafür, dass die App in jedem Unterordner
// läuft (z. B. https://<name>.github.io/anatomie-lernen/).
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  build: { target: 'safari16', chunkSizeWarningLimit: 1200 },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      // Alles, was die App braucht, wird beim ersten Besuch gespeichert -> danach offline nutzbar.
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,json,glb,webmanifest}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        cleanupOutdatedCaches: true,
      },
      includeAssets: ['icons/*.png', 'icons/icon.svg'],
      manifest: {
        name: 'Anatomie lernen',
        short_name: 'Anatomie',
        description: '3D-Anatomie zum Lernen für die Physiotherapie-Ausbildung',
        lang: 'de',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        background_color: '#f4f2ee',
        theme_color: '#f4f2ee',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
