import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

/**
 * GitHub Pages serves this project at /<repo-name>/, not at the domain root,
 * so every asset URL needs that prefix. The deploy workflow sets BASE_PATH;
 * locally it falls back to "/" so `npm run dev` behaves normally.
 */
export default defineConfig({
  base: process.env.BASE_PATH || "/",
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
