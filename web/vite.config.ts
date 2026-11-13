import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
// The version lives in the root package.json, shared with the server.
import pkg from '../package.json'

/**
 * When it was built, as a single number: 202608101157.
 *
 * No dashes or colons because it isn't a date to read but a marker to compare
 * at a glance against the phone's or the server's: it reads in one go and sorts
 * itself.
 */
function buildDate(): string {
  const d = new Date()
  const dd = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${dd(d.getMonth() + 1)}${dd(d.getDate())}${dd(d.getHours())}${dd(d.getMinutes())}`
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    // Installable app. The service worker only caches the app itself — the
    // data is live over MQTT and never goes through it.
    VitePWA({
      // A new version installs on its own but waits: the app shows a banner
      // and switches when you tap it (src/pwa.ts). Taking over by itself would
      // leave an open tab running the old version against files that no
      // longer exist, which breaks the first visit to a tab it hadn't loaded.
      registerType: 'prompt',
      injectRegister: false, // registered from src/pwa.ts
      includeAssets: ['favicon.svg', 'favicon-error.svg', 'favicon-warn.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Pi5 Dashboard',
        short_name: 'Pi5',
        description: 'Live status and controls for a Raspberry Pi 5 in a Pironman5 case',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        background_color: '#0d0e14',
        theme_color: '#13141c',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Every tab's address is served the app, even offline or on a server
        // without the SPA fallback configured.
        navigateFallback: 'index.html',
        // ...except the API, which must always reach the server.
        navigateFallbackDenylist: [/^\/api\//],
        // Each deploy's precache replaces the last one instead of piling up.
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  server: {
    // In development the API runs separately (npm run dev starts both).
    proxy: {
      '/api': 'http://localhost:3010',
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(buildDate()),
  },
})
