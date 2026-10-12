import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:3000",
      "/uploads": "http://127.0.0.1:3000",
      "/nomor": "http://127.0.0.1:3000",
      "/robots.txt": "http://127.0.0.1:3000",
      "/sitemap.xml": "http://127.0.0.1:3000",
    },
  },
});
