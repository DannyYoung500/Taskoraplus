export function renderErrorPage(details?: unknown): string {
  const errText = details ? (details instanceof Error ? details.stack || details.message : String(details)) : "";
  return `<!doctype html>
<html lang="en" class="dark" style="background-color: #0b1424; color: #f1f5f9;">
  <head>
    <meta charset="utf-8" />
    <title>TASKORA — This page didn't load</title>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#0b1424" />
    <meta name="color-scheme" content="dark" />
    <style>
      * { box-sizing: border-box; }
      html, body {
        font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        background: #0b1424;
        color: #f1f5f9;
        display: grid;
        place-items: center;
        min-height: 100vh;
        margin: 0;
        padding: 1.5rem;
      }
      .card {
        max-width: 28rem;
        width: 100%;
        text-align: center;
        padding: 2.5rem 2rem;
        background: #121f33;
        border: 1px solid rgba(148, 163, 184, 0.15);
        border-radius: 1.25rem;
        box-shadow: 0 20px 40px rgba(0,0,0,0.5);
      }
      h1 { font-size: 1.25rem; font-weight: 700; margin: 0 0 0.5rem; color: #ffffff; }
      p { color: #94a3b8; font-size: 0.875rem; margin: 0 0 1.5rem; }
      pre { text-align: left; background: #070c17; color: #f87171; padding: 0.75rem; border-radius: 0.5rem; font-size: 11px; overflow: auto; max-height: 150px; white-space: pre-wrap; word-break: break-all; margin-bottom: 1rem; }
      .actions { display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap; }
      a, button {
        padding: 0.65rem 1.25rem;
        border-radius: 0.75rem;
        font: inherit;
        font-weight: 600;
        font-size: 0.875rem;
        cursor: pointer;
        text-decoration: none;
        border: 1px solid transparent;
        transition: opacity 0.2s;
      }
      a:hover, button:hover { opacity: 0.9; }
      .primary { background: linear-gradient(135deg, #38bdf8, #2563eb); color: #fff; }
      .secondary { background: rgba(255, 255, 255, 0.06); color: #e2e8f0; border-color: rgba(148, 163, 184, 0.2); }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>This page didn't load</h1>
      <p>Something went wrong. You can try refreshing or head back home.</p>
      ${errText ? `<pre>${errText.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>` : ""}
      <div class="actions">
        <button class="primary" onclick="location.reload()">Try again</button>
        <a class="secondary" href="/">Go home</a>
      </div>
    </div>
  </body>
</html>`;
}
