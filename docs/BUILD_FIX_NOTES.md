# Build fix notes

## Cause of `bun run build` exit 1 (likely)

Client routes imported `taskora-mutations.functions.ts` which had a **top-level** import of `platform-rules.server.ts`.

In Vite / TanStack Start, `*.server` modules must not be in the client module graph via static imports.

## Fix

- Inlined platform rules inside `taskora-mutations.functions.ts`
- Dynamic-import only for `client.server` inside handlers
- Fixed `React.ComponentType` → `import type { ComponentType }`
- Regenerated `routeTree.gen.ts` for all owner routes

## If build still fails

Paste the **full** Vercel build log lines above `error: script "build" exited with code 1` (the TypeScript or Vite error message).
