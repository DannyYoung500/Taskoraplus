// Public TanStack Start + Nitro config (no private Lovable packages).
// Works on Vercel, local, and other Nitro targets.
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

// Map server-only Supabase env → VITE_* so the browser client and server
// always target the same project (avoids JWT kid mismatches on Vercel).
if (process.env["SUPABASE_URL"]) {
  process.env["VITE_SUPABASE_URL"] = process.env["SUPABASE_URL"];
}
if (process.env["SUPABASE_PUBLISHABLE_KEY"]) {
  process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] =
    process.env["SUPABASE_PUBLISHABLE_KEY"];
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
    // Nitro auto-detects Vercel in CI; override with SERVER_PRESET if needed.
    nitro({
      preset: process.env.SERVER_PRESET || undefined,
    }),
    viteReact(),
  ],
});
