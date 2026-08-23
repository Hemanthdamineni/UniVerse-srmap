import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

const staticPrototype =
  process.env.VITE_STATIC_PROTOTYPE === 'true' || process.env.VITE_STATIC_PROTOTYPE === '1'

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [
    react(),
    tailwindcss(),
    // The installable app targets the real deployment only: the static
    // prototype host serves fixtures and must never ship a service worker.
    ...(staticPrototype
      ? []
      : [
          VitePWA({
            registerType: 'autoUpdate',
            injectRegister: 'auto',
            includeAssets: ['CircularSrmLogo.png'],
            manifest: {
              name: 'UniVerse — SRMAP Edition',
              short_name: 'UniVerse',
              description:
                'Student portal for SRM AP: attendance, marks, fees, timetable, events, LMS resources and career opportunities.',
              theme_color: '#0A3035',
              background_color: '#F8F8F8',
              display: 'standalone',
              start_url: '/',
              icons: [
                { src: '/pwa/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
                { src: '/pwa/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
                { src: '/pwa/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
                { src: '/pwa/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
              ],
            },
            workbox: {
              navigateFallback: '/index.html',
              globPatterns: ['**/*.{js,css,html,woff2,svg,png}'],
              navigateFallbackDenylist: [/^\/api\//, /^\/uploads\//],
              runtimeCaching: [
                {
                  // ERP/LMS payloads are session-scoped; a stale offline copy
                  // must never masquerade as live data.
                  urlPattern: ({ url }) =>
                    url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/'),
                  handler: 'NetworkOnly',
                },
              ],
            },
            devOptions: { enabled: false },
          }),
        ]),
  ],
  build: {
    ...(staticPrototype
      ? {
          outDir: path.resolve(__dirname, '../StaticHost/dist'),
          emptyOutDir: true,
        }
      : {}),
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          // axios is only used by the login screens; leaving it out of the
          // eager vendor chunk keeps it in their lazy route chunks instead of
          // shipping ~14 KB gz to every page.
          vendor: ["clsx", "tailwind-merge"],
          charts: ["recharts"],
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: [".loca.lt"], // or ["kind-bananas-make.loca.lt"]
    proxy: {
      "/api": process.env.VITE_API_PROXY_TARGET || "http://localhost:5000",
      "/uploads": process.env.VITE_API_PROXY_TARGET || "http://localhost:5000",
    },
  },
});
