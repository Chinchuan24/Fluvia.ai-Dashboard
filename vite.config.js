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
});
