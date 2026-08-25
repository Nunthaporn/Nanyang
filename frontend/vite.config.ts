import { defineConfig, searchForWorkspaceRoot } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

const dep = (name: string) =>
  fileURLToPath(new URL(`./node_modules/${name}`, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      react: dep("react"),
      "react-dom": dep("react-dom"),
      axios: dep("axios"),
      echarts: dep("echarts"),
      "echarts-for-react": dep("echarts-for-react"),
      "lucide-react": dep("lucide-react"),
    },
    dedupe: ["react", "react-dom", "echarts"],
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    fs: {
      allow: [searchForWorkspaceRoot(process.cwd()), ".."],
    },
    proxy: {
      "/api": {
        target: "http://localhost:8001",
        changeOrigin: true,
      },
    },
  },
});
