// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// The browser Supabase client is compiled from the `VITE_*` env vars, while all
// server code reads `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY`. In hosted
// environments (e.g. Vercel) only the non-prefixed server vars are defined, so
// without this mapping the client would be built for a *different* Supabase
// project than the server. That mismatch makes the server mint tokens the
// browser can't verify ("unrecognized JWT kid ... for ES256"). Copy the server
// values onto the VITE_ names so the client and server always target the same
// project. Vite's loadEnv gives process.env precedence over committed .env files,
// so this reliably overrides any stale VITE_ values checked into the repo.
if (process.env["SUPABASE_URL"]) {
  process.env["VITE_SUPABASE_URL"] = process.env["SUPABASE_URL"];
}
if (process.env["SUPABASE_PUBLISHABLE_KEY"]) {
  process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] = process.env["SUPABASE_PUBLISHABLE_KEY"];
}

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
