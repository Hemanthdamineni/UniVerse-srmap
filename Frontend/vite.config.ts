import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

const staticPrototype =
  process.env.VITE_STATIC_PROTOTYPE === 'true' || process.env.VITE_STATIC_PROTOTYPE === '1'

// https://vite.dev/config/
export default defineConfig({
  base: staticPrototype ? './' : '/',
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
          vendor: ["axios", "date-fns", "clsx", "tailwind-merge"],
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
      "/api": "http://localhost:5000",
      "/uploads": "http://localhost:5000",
    },
  },
});