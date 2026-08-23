import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

const staticPrototype =
  process.env.VITE_STATIC_PROTOTYPE === 'true' || process.env.VITE_STATIC_PROTOTYPE === '1'

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react(), tailwindcss()],
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
