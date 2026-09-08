import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

/**
 * Vercel serves the site from the domain root, so assets need no path prefix
 * and `base` stays "/". If you ever move to a host that serves from a
 * subdirectory (GitHub Pages puts a project site at /<repo-name>/), set
 * BASE_PATH in that host's build environment.
 */
export default defineConfig({
  base: process.env.BASE_PATH || "/",
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  build: {
    rollupOptions: {
      output: {
        /**
         * Split the heavy dependencies out of the app bundle. They change on
         * their own schedule, so a change to the dashboard should not force a
         * repeat download of the charting library. Recharts and framer-motion
         * are the two big ones.
         */
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          charts: ["recharts"],
          motion: ["framer-motion"],
          supabase: ["@supabase/supabase-js"],
        },
      },
    },
  },
});
