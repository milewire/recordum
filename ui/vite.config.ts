import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/workflows": { target: "http://localhost:8000", changeOrigin: true },
      "/workflow":  { target: "http://localhost:8000", changeOrigin: true },
      "/audit":     { target: "http://localhost:8000", changeOrigin: true },
      "/settings":  { target: "http://localhost:8000", changeOrigin: true },
    },
  },
});
