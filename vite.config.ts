// Public TanStack Start + Nitro config for Vercel.
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

// Map server-only Supabase env → VITE_* so browser + server use same project.
if (process.env["SUPABASE_URL"]) {
  process.env["VITE_SUPABASE_URL"] = process.env["SUPABASE_URL"];
}
if (process.env["SUPABASE_PUBLISHABLE_KEY"]) {
  process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] = process.env["SUPABASE_PUBLISHABLE_KEY"];
}

export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [
    tsconfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    tanstackStart({
      srcDirectory: "src",
    }),
    nitro({
      serverEntry: "./server.ts",
      renderer: false,
    }),
    viteReact(),
  ],
  environments: {
    ssr: { build: { rollupOptions: { input: "./server.ts" } } },
  },
});
