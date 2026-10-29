# Evidencias de conexión y uso — MCP (2026-10-29)

Máquina: Windows 11, Node v24.19.0, OpenCode con config global `~/.config/opencode/opencode.json`.
Todos los outputs fueron capturados de ejecuciones reales en esta fecha.

## Cómo correr cada evidencia

```bash
node docs/skills-mcp/evidencias/probe-context7-http.js       # handshake remoto + tools/list + tool call real
node docs/skills-mcp/evidencias/probe-playwright-handshake.js npx -y @playwright/mcp@latest --headless --isolated
node docs/skills-mcp/evidencias/probe-playwright-e2e.js     # navegar + snapshot + eval (requiere navegador instalado)
```

> Nota: los probes de Playwright MCP lanzan el servidor y abortan por timeout propio a los 90 s
> si algo falla; el e2e usa `--browser chromium`.

---

## 1. Context7 MCP — salud del servidor (HTTP 200)

```
$ curl -s https://mcp.context7.com/ping
{"status":"ok","message":"pong"}        # HTTP 200
```

## 2. Context7 MCP — handshake MCP Streamable HTTP

`node probe-context7-http.js`:

```
HTTP_STATUS 200 | CT: text/    <- streamable HTTP con SSE
INIT_MS 654
SERVER_INFO {"name":"Context7","version":"4.4.3", "websiteUrl":"https://context7.com", ...}
PROTOCOL 2024-11-05
CAPABILITIES {"tools":{"listChanged":false},"prompts":{...},"resources":{...}}
TOOLS_COUNT 2
TOOL resolve-library-id | Resolves a package/product name to a Context7-compatible library ID ...
TOOL query-docs | Retrieves and queries up-to-date documentation and code examples ...
```

## 3. Context7 MCP — llamada real de herramienta

Mismo probe, sección "¿Funciona sin credenciales?":

```
CALL_MS 1048 | STATUS 200        <- sin API key, tier anónimo
CALL_RESULT Available Libraries:
- Title: FastAPI
- Context7-compatible library ID: /websites/fastapi_tiangolo
- Description: FastAPI is a modern, high-performance web framework for building APIs with Python...
```

## 4. Context7 MCP — llamadas vía OpenCode (mismo día, sesión con MCP configurado)

- `resolve-library-id { libraryName: "Zod", query: "schema validation express node" }`
  → `/websites/zod_dev`
- `resolve-library-id { libraryName: "Express", query: "node web framework middleware" }`
  → `/websites/expressjs`
- `query-docs { libraryId: "/websites/expressjs", query: "Express.js route middleware error handling best practices", language: "JavaScript" }`
  → Devolvió doc. real de Express 5 con URL fuente:
  `Source: https://expressjs.com/en/5x/guide/error-handling/` — incluye patrón recomendado
  (`async` handlers que llaman `next(value)` automáticamente al rechazar).

## 5. Playwright MCP — handshake por stdio (candidato B, no elegido)

```
$ node probe-playwright-handshake.js npx -y @playwright/mcp@latest --headless --isolated
INIT_OK {"name":"Playwright","version":"1.64.0-alpha-1790635538000"}
PROTOCOL 2024-11-05
HANDSHAKE_MS 1596
TOOLS_COUNT 25
TOOLS browser_close, browser_resize, browser_console_messages, browser_handle_dialog,
      browser_emulate_media, browser_evaluate, browser_file_upload, browser_drop, browser_find,
      browser_fill_form, browser_press_key, browser_type, browser_navigate, browser_navigate_back,
      browser_network_requests, browser_network_request, browser_run_code_unsafe,
      browser_take_screenshot, browser_snapshot, browser_click, browser_drag, browser_hover,
      browser_select_option, browser_tabs, browser_wait_for
```

## 6. Playwright MCP — prueba funcional end-to-end

`node probe-playwright-e2e.js` (tras instalar el navegador, ver gotcha abajo):

```
SERVER Playwright 1.64.0-alpha-1790635538000
NAV_MS 1556
NAV_RESULT (page.goto data:text/html,<h1>Hola desde Playwright MCP</h1>...)
SNAPSHOT - heading "Hola desde Playwright MCP" [level=1] [ref=e2]
         - button "Click me" [ref=e3]
EVAL "MCP Test"          (document.title)
```

## 7. Gotcha documentado: instalación del navegador del MCP

Primera tool call del MCP falló si el navegador no está — el servidor **sí** arranca, falla tarde:

```
Error: async initializeServer: Chromium distribution 'chrome' is not found at ...
Run "npx playwright install chrome"
```

Error señuelo #1: `npx playwright install chromium` instala build **1248**, pero este paquete fija **1247**:

```
Error: Browser "chrome-for-testing" is not installed; expected executable at
...\ms-playwright\chromium-1247\chrome-win64\chrome.exe.
Run `npx @playwright/mcp install-browser ...`
```

Comando correcto (usó 119 MB):

```
$ npx -y @playwright/mcp@latest install-browser chromium
Chrome Headless Shell 155.0.8059.12 (playwright chromium-headless-shell v1247)... downloaded
```

Luego la prueba e2e de la sección 6 pasó completa.
